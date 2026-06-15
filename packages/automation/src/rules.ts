import { z } from "zod";

export const automationRuleSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  trigger: z.enum(["new_lead", "new_tag", "inactivity"]),
  actions: z
    .array(z.enum(["send_message", "add_tag", "create_task", "pause_ai"]))
    .min(1)
});

export type AutomationRule = z.infer<typeof automationRuleSchema>;
