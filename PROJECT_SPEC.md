# CRM PRO AI

## Descripción General

CRM PRO AI es una plataforma SaaS multi-tenant inspirada funcionalmente en Prometheo AI.

Su objetivo es permitir a empresas gestionar conversaciones, leads, asistentes IA, automatizaciones, Smart Tags, variables inteligentes e integraciones desde una única plataforma.

La arquitectura debe estar preparada para miles de organizaciones utilizando una única base de datos con aislamiento completo mediante organization_id y Row Level Security.

---

# Infraestructura

## GitHub

Repositorio:

CRM-prom

## Supabase

Project Ref:

widehqbtmqiebaowidav

URL:

https://widehqbtmqiebaowidav.supabase.co

## Deploy

Frontend:

Vercel

Backend:

Next.js Route Handlers + Supabase

Base de datos:

Supabase PostgreSQL

Realtime:

Supabase Realtime

Storage:

Supabase Storage

---

# Stack Tecnológico

* Next.js 15
* React
* TypeScript
* Tailwind
* shadcn/ui
* Supabase Auth
* PostgreSQL
* Realtime
* Storage
* OpenAI API
* React Hook Form
* Zod
* ESLint
* Prettier
* Vitest
* Playwright

---

# Arquitectura General

Monorepo.

Estructura:

/apps/web

/packages/database

/packages/types

/packages/ui

/packages/ai

/packages/integrations

/packages/automation

/docs

/scripts

---

# Multi Tenant

Todas las tablas deben incluir:

* id
* organization_id
* created_at
* updated_at

Todo acceso debe filtrarse mediante RLS.

Ningún usuario puede visualizar datos de otra organización.

Roles:

* owner
* admin
* agent

---

# Módulo CRM

## Leads

Campos mínimos:

* nombre
* apellido
* email
* teléfono
* empresa
* origen
* estado
* responsable
* observaciones

Estados:

* nuevo
* contactado
* interesado
* propuesta
* ganado
* perdido

---

## Contactos

Debe existir separación entre Lead y Contacto.

Un lead puede convertirse en contacto.

---

## Pipeline

Vista Kanban.

Drag and Drop.

Persistencia en tiempo real.

---

# Inbox Conversacional

Vista similar a WhatsApp Web.

Funcionalidades:

* lista de conversaciones
* búsqueda
* filtros
* mensajes en tiempo real
* asignación de agentes
* historial completo
* estado IA

Estados IA:

* activa
* pausada
* humano

---

# WhatsApp Cloud API

Implementar:

Webhook GET

Webhook POST

Recepción:

* texto
* imagen
* audio
* documento
* ubicación

Envío:

* texto
* imagen
* documento

Registrar:

* payload recibido
* payload enviado
* errores

---

# Motor de IA

Crear servicio central:

AIOrchestrator

Responsabilidades:

* construir contexto
* obtener historial
* obtener variables
* obtener tags
* obtener información del lead
* obtener instrucciones del asistente

Enviar contexto al modelo IA.

Registrar logs completos.

---

# Asistentes IA

CRUD completo.

Configuración:

* nombre
* descripción
* prompt
* objetivo
* tono
* reglas
* mensaje fallback

Canales:

* WhatsApp
* WebChat

---

# Smart Tags

Clasificación automática mediante IA.

Ejemplos:

* comprador
* vendedor
* urgente
* interesado
* presupuesto_alto
* presupuesto_bajo

Configuración:

* color
* descripción
* prompt de clasificación
* pausa automática
* notificación interna

---

# Variables Inteligentes

Tipos:

* texto
* número
* precio
* booleano
* opción
* link
* texto largo

Cada variable posee:

* extraction_prompt

Guardar:

* valor
* confianza
* mensaje origen

---

# Automatizaciones

Triggers:

* lead creado
* mensaje recibido
* tag asignado
* variable modificada
* inactividad

Acciones:

* enviar mensaje
* pausar IA
* asignar tag
* crear tarea
* notificar usuario

---

# Scheduler

Tabla:

automation_runs

Estados:

* pending
* running
* completed
* failed

Preparado para:

* Vercel Cron
* Supabase Cron

---

# WebChat

Widget embebible.

Script:

```html
<script src="crm-pro-ai-widget.js"></script>
```

Funciones:

* iniciar conversación
* continuar conversación
* conectarse al asistente IA
* capturar nombre
* capturar email
* capturar teléfono

---

# Integraciones

## Fase MVP

Google Sheets

HTTP Custom Connect

---

## Custom Connect

Permitir crear herramientas externas.

Campos:

* nombre
* descripción
* método
* url
* headers
* body_schema
* response_schema

El asistente IA podrá consumir herramientas externas.

---

# Dashboard

KPIs:

* leads totales
* leads nuevos
* conversaciones activas
* conversaciones cerradas
* mensajes enviados
* mensajes recibidos
* uso IA
* tokens consumidos

---

# Configuración

Secciones:

* organización
* usuarios
* roles
* canales
* asistentes
* smart tags
* variables
* automatizaciones
* integraciones

---

# Auditoría

Registrar:

* login
* logout
* creación
* edición
* eliminación

Tabla:

audit_logs

---

# Seguridad

Implementar:

* RLS completo
* validación Zod
* rate limit
* sanitización
* protección webhooks
* manejo seguro de errores

Nunca exponer secretos al frontend.

---

# Testing

Unitarios:

* AIOrchestrator
* SmartTagClassifier
* VariableExtractor
* WhatsAppWebhookHandler

E2E:

* login
* creación lead
* creación asistente
* creación smart tag
* visualización inbox

---

# Documentación

Generar:

README.md

docs/ARCHITECTURE.md

docs/DATABASE.md

docs/AI_ORCHESTRATION.md

docs/WHATSAPP_SETUP.md

docs/DEPLOYMENT_VERCEL_SUPABASE.md

docs/ROADMAP.md

---

# Roadmap Futuro

## Fase 2

* Instagram DM
* Facebook Messenger
* Telegram
* Email Inbox

## Fase 3

* Voice AI
* Llamadas automáticas
* Speech To Text
* Text To Speech

## Fase 4

* Embudos visuales avanzados
* Agentes IA especializados
* Marketplace de integraciones

---

# Criterios de Finalización

Antes de finalizar:

* npm run lint
* npm run build
* npm run test

Corregir todos los errores encontrados.

No entregar funcionalidades incompletas.

No utilizar mocks excepto donde sea estrictamente necesario.

Todo debe quedar listo para producción.
