/** Google API calls — each function takes an accessToken, makes HTTP calls, returns typed data */

const GMAIL_BASE   = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const SHEETS_BASE  = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE   = "https://www.googleapis.com/drive/v3";

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function googleFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeader(token), "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error("Google token expired or invalid. Please reconnect this integration.");
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Gmail ────────────────────────────────────────────────────────────────────

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
  body?: string;
};

export async function gmailSearchMessages(token: string, query: string, limit = 10): Promise<GmailMessage[]> {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;
  const list = await googleFetch<{ messages?: { id: string; threadId: string }[] }>(url, token);
  if (!list.messages?.length) return [];

  const messages = await Promise.all(
    list.messages.slice(0, limit).map(async (m) => {
      const detail = await googleFetch<{
        id: string;
        threadId: string;
        snippet: string;
        payload?: { headers?: { name: string; value: string }[] };
      }>(`${GMAIL_BASE}/messages/${m.id}?format=metadata&metadataHeaders=Subject,From,Date`, token);
      const headers = detail.payload?.headers ?? [];
      return {
        id:       detail.id,
        threadId: detail.threadId,
        snippet:  detail.snippet,
        subject:  headers.find((h) => h.name === "Subject")?.value,
        from:     headers.find((h) => h.name === "From")?.value,
        date:     headers.find((h) => h.name === "Date")?.value,
      };
    }),
  );
  return messages;
}

export async function gmailSendMessage(token: string, params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<{ id: string; threadId: string }> {
  const raw = [
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : null,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body,
  ].filter(Boolean).join("\r\n");

  const encoded = Buffer.from(raw).toString("base64url");
  return googleFetch<{ id: string; threadId: string }>(`${GMAIL_BASE}/messages/send`, token, {
    method: "POST",
    body: JSON.stringify({ raw: encoded }),
  });
}

export async function gmailGetMessage(token: string, messageId: string): Promise<GmailMessage> {
  const detail = await googleFetch<{
    id: string;
    threadId: string;
    snippet: string;
    payload?: {
      headers?: { name: string; value: string }[];
      body?: { data?: string };
      parts?: { body?: { data?: string }; mimeType?: string }[];
    };
  }>(`${GMAIL_BASE}/messages/${messageId}?format=full`, token);

  const headers = detail.payload?.headers ?? [];
  let body = detail.payload?.body?.data;
  if (!body) {
    body = detail.payload?.parts?.find((p) => p.mimeType === "text/plain")?.body?.data;
  }

  return {
    id:       detail.id,
    threadId: detail.threadId,
    snippet:  detail.snippet,
    subject:  headers.find((h) => h.name === "Subject")?.value,
    from:     headers.find((h) => h.name === "From")?.value,
    date:     headers.find((h) => h.name === "Date")?.value,
    body:     body ? Buffer.from(body, "base64url").toString("utf-8") : undefined,
  };
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  htmlLink?: string;
};

type GoogleCalendarRawEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  htmlLink?: string;
};

export async function calendarListEvents(token: string, params: {
  limit?: number;
  daysAhead?: number;
  calendarId?: string;
}): Promise<CalendarEvent[]> {
  const { limit = 10, daysAhead = 7, calendarId = "primary" } = params;
  const now  = new Date().toISOString();
  const until = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
    + `?maxResults=${limit}&orderBy=startTime&singleEvents=true&timeMin=${now}&timeMax=${until}`;
  const res = await googleFetch<{ items?: GoogleCalendarRawEvent[] }>(url, token);
  return (res.items ?? []).map((e) => ({
    id:          e.id,
    summary:     e.summary,
    description: e.description,
    location:    e.location,
    start:       e.start?.dateTime ?? e.start?.date,
    end:         e.end?.dateTime   ?? e.end?.date,
    attendees:   e.attendees?.map((a) => a.email),
    htmlLink:    e.htmlLink,
  }));
}

export async function calendarCreateEvent(token: string, params: {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  calendarId?: string;
}): Promise<CalendarEvent> {
  const { calendarId = "primary", ...rest } = params;
  const body = {
    summary:     rest.title,
    description: rest.description,
    location:    rest.location,
    start:       { dateTime: rest.start },
    end:         { dateTime: rest.end },
    attendees:   rest.attendees?.map((email) => ({ email })),
  };
  return googleFetch<CalendarEvent>(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function calendarCheckAvailability(token: string, params: {
  start: string;
  end: string;
  calendarId?: string;
}): Promise<{ busy: boolean; periods: { start: string; end: string }[] }> {
  const { calendarId = "primary", start, end } = params;
  const body = {
    timeMin: start,
    timeMax: end,
    items:   [{ id: calendarId }],
  };
  const res = await googleFetch<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>(
    `${CALENDAR_BASE}/freeBusy`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  const periods = res.calendars?.[calendarId]?.busy ?? [];
  return { busy: periods.length > 0, periods };
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

export async function sheetsReadRange(token: string, spreadsheetId: string, range?: string, sheetName?: string): Promise<{ values: unknown[][] }> {
  const fullRange = sheetName ? `${sheetName}!${range ?? "A1:Z1000"}` : (range ?? "A1:Z1000");
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(fullRange)}`;
  return googleFetch<{ values: unknown[][] }>(url, token);
}

export async function sheetsAppendRow(token: string, spreadsheetId: string, values: unknown[], sheetName?: string): Promise<void> {
  const range = sheetName ?? "Sheet1";
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  await googleFetch(url, token, {
    method: "POST",
    body: JSON.stringify({ values: [values] }),
  });
}

export async function sheetsUpdateRow(token: string, spreadsheetId: string, rowIndex: number, values: unknown[], sheetName?: string): Promise<void> {
  const sheet = sheetName ?? "Sheet1";
  const range = `${sheet}!A${rowIndex}`;
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await googleFetch(url, token, {
    method: "PUT",
    body: JSON.stringify({ values: [values] }),
  });
}

export async function sheetsSearchRows(token: string, spreadsheetId: string, query: string, sheetName?: string): Promise<unknown[][]> {
  const { values = [] } = await sheetsReadRange(token, spreadsheetId, undefined, sheetName);
  const q = query.toLowerCase();
  return values.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
}

// ─── Drive ────────────────────────────────────────────────────────────────────

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
};

export async function driveListFiles(token: string, params: {
  folderId?: string;
  query?: string;
  limit?: number;
}): Promise<DriveFile[]> {
  const { folderId, query, limit = 20 } = params;
  const parts: string[] = ["trashed = false"];
  if (folderId) parts.push(`'${folderId}' in parents`);
  if (query)    parts.push(`name contains '${query.replace(/'/g, "\\'")}'`);

  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(parts.join(" and "))}`
    + `&pageSize=${limit}&fields=files(id,name,mimeType,webViewLink,webContentLink,modifiedTime)`;
  const res = await googleFetch<{ files: DriveFile[] }>(url, token);
  return res.files ?? [];
}

export async function driveGetFileUrl(token: string, fileId: string): Promise<{ webViewLink: string | null; webContentLink: string | null }> {
  const url = `${DRIVE_BASE}/files/${fileId}?fields=webViewLink,webContentLink`;
  const res = await googleFetch<{ webViewLink?: string; webContentLink?: string }>(url, token);
  return { webViewLink: res.webViewLink ?? null, webContentLink: res.webContentLink ?? null };
}
