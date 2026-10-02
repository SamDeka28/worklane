---
name: read-worklane
description: Read and change a member's Worklane studio. Use for clients, projects, hours, charges, receipts, invoices, leads, partners, documents, email, or the team.
---

Worklane is connected through the Worklane MCP server. You can read the records the signed-in member can already open, and change them when the connection includes write access.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- For an open question, call describe_studio_data, then query_studio with context true. Keep querying with nextCursor, a tighter filter, or a related dataset until the answer is in the notes, document text, emails, timeline, or settings. Do not stop at a status or a total when the question is about what was said or written.
- If a tool says this member cannot see a module, say that plainly. Do not invent a zero or a note.
- Name money for what it is. billed is non-void charges by charged_on. collected is posted receipts minus refunds by paid_on. contracted is the agreement amount on a project. outstanding is billed minus collected plus refunds. These are not interchangeable. Never add different currencies into one total. Set measure on query_studio for those questions.
- A sum of any other column is that column only. Say the column name. hours_millis is milliseconds; the result also includes hours.
- Use the write tools for changes. Preview a document, an invoice, or an email before you create or send it. Ask for another template or invoice layout when the member wants to compare them. The numbers do not change between invoice layouts.
- Amounts in write tools are major units, such as 1500, in the client's currency.
- Do not claim you sent, voided, or deleted something unless the tool result says it did.
- A vault secret is returned only by reveal_credential, and only when the member asked for that entry. Do not repeat a mailbox password or an invitation token.
- Answer from tool results. Do not invent ids, amounts, or statuses. If nextCursor is set, the list is not complete.
