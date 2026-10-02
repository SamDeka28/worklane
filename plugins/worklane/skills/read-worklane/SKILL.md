---
name: read-worklane
description: Read a member's Worklane studios, clients, projects, invoices, and leads. Use when the user asks about studio work, who a client is, project status, what is owed, or the lead pipeline.
---

Worklane is connected through the Worklane MCP server. You can read studios, clients, projects, invoices, and leads for the signed-in member.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- These tools are read-only. Do not claim you created a client, posted a charge, sent an email, or changed a record.
- Invoice totals and project money appear only when this member can see finance. If a tool says they do not have access, say that plainly.
- Answer from tool results. Do not invent ids, amounts, or statuses.
