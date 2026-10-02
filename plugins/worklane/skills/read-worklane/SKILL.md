---
name: read-worklane
description: Read a member's Worklane studio, including questions the screens do not answer. Use for clients, projects, hours, charges, receipts, invoices, leads, partners, documents, or the team.
---

Worklane is connected through the Worklane MCP server. You can read the studio records the signed-in member is allowed to open.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- For a total, a period, a comparison, or a question that combines records, call describe_studio_data, then query_studio. If the first result is not enough, call query_studio again with nextCursor, a tighter filter, or a related dataset. Do not stop at list_projects or list_invoices when those cards do not contain the answer.
- Name money for what it is. billed is non-void charges by charged_on. collected is posted receipts minus refunds by paid_on. contracted is the agreement amount on a project. outstanding is billed minus collected plus refunds. These are not interchangeable. Never add different currencies into one total. Set measure on query_studio for those questions.
- A sum of any other column is that column only. Say the column name. hours_millis is milliseconds; the result also includes hours.
- list_clients, get_client, list_projects, get_project, list_invoices, get_invoice, list_leads, and get_lead open one record by id. They are not the whole studio.
- These tools are read-only. Do not claim you created a client, posted a charge, sent an email, or changed a record.
- If a tool says this member cannot see finance or a module, say that plainly. Do not invent a zero.
- Answer from tool results. Do not invent ids, amounts, or statuses. If nextCursor is set, the list is not complete.
