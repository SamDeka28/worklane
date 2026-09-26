import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { supabaseAuthEmailTemplates } from "../src/shared/email/auth-templates";

const outDir = join(process.cwd(), "supabase", "templates");
mkdirSync(outDir, { recursive: true });

const subjects: Record<string, { template: string; subject: string }> = {};
for (const template of supabaseAuthEmailTemplates()) {
  writeFileSync(join(outDir, template.file), `${template.html}\n`);
  subjects[template.file] = { template: template.dashboardName, subject: template.subject };
  console.log(`${template.dashboardName.padEnd(22)} ${template.file.padEnd(24)} "${template.subject}"`);
}
writeFileSync(join(outDir, "subjects.json"), `${JSON.stringify(subjects, null, 2)}\n`);
