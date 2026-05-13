import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import PageHeader from "@/components/layout/PageHeader"
import SetupDiagnostics from "@/components/setup/SetupDiagnostics"
import { ShieldAlert } from "lucide-react"

export default function SetupGuidePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        title="Setup Guide"
        description="Set up your Discord bot, server roles, environment, and dashboard connection—from zero to a working instructor workspace."
      />

      <Alert>
        <ShieldAlert />
        <AlertTitle>Local / private dashboard</AlertTitle>
        <AlertDescription>
          This dashboard has no login yet. Anyone who can open this URL in your network can use
          these tools. Do not expose it to the public internet without adding authentication. Never
          put <code className="text-xs bg-muted px-1 rounded">BOT_API_KEY</code> or your Discord
          token in <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_*</code> variables.
        </AlertDescription>
      </Alert>

      <SetupDiagnostics />

      <Accordion type="multiple" defaultValue={["overview"]} className="w-full">
        <AccordionItem value="overview">
          <AccordionTrigger>1. Overview — what must be ready</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>Before teaching with this product, you should have:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Discord application and bot user</li>
              <li>Bot token stored only in server-side env (never in the browser)</li>
              <li>Bot invited to your server with sensible permissions</li>
              <li>An Instructor role (and bot role above it in the hierarchy)</li>
              <li>Environment variables for bot + dashboard aligned on API URL, API key, and DB path</li>
              <li>Bot process running (<code className="text-xs">node index.js</code>)</li>
              <li>Dashboard running (<code className="text-xs">pnpm dev</code> in <code className="text-xs">dashboard/</code>)</li>
              <li>Smoke tests: health, guilds, a sample command, one session flow</li>
            </ul>
            <p>
              Use the diagnostics panel above while you work through the steps. For day-to-day
              teaching workflows, use{" "}
              <Link href="/" className="text-primary underline">
                Home
              </Link>{" "}
              and{" "}
              <Link href="/record" className="text-primary underline">
                Record Session
              </Link>
              .
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="discord-app">
          <AccordionTrigger>2. Create Discord application &amp; bot</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Open the{" "}
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Discord Developer Portal
                </a>
                .
              </li>
              <li>Create a New Application and name it (e.g. your course or org).</li>
              <li>Open the Bot tab → Add Bot.</li>
              <li>Reset / copy the token once and store it in your root <code className="text-xs bg-muted px-1 rounded">.env</code> as <code className="text-xs bg-muted px-1 rounded">DISCORD_TOKEN</code> — do not commit it.</li>
              <li>
                Under Privileged Gateway Intents, enable only what you need:
                <ul className="list-disc pl-5 mt-1">
                  <li>
                    <strong>Server Members Intent</strong> if you rely on member lists or permission checks.
                  </li>
                  <li>
                    <strong>Message Content Intent</strong> if you use prefix commands that read message text.
                  </li>
                  <li>
                    <strong>Presence</strong> only if you explicitly need presence; otherwise leave off.
                  </li>
                </ul>
              </li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="permissions">
          <AccordionTrigger>3. Bot permissions (invite)</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>Suggested permissions for a classroom bot:</p>
            <ul className="list-disc pl-5">
              <li>View Channels</li>
              <li>Send Messages</li>
              <li>Read Message History</li>
              <li>Connect &amp; Speak (voice sessions)</li>
              <li>Use Voice Activity (if applicable)</li>
              <li>Manage Roles — only if you use <code className="text-xs bg-muted px-1 rounded">!add-instructor</code> / <code className="text-xs bg-muted px-1 rounded">!remove-instructor</code></li>
            </ul>
            <p>
              <strong>Administrator</strong> is convenient for quick local testing but is not recommended for production servers. Prefer least privilege.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="invite">
          <AccordionTrigger>4. Invite bot to server</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-2">
              <li>In the Developer Portal: OAuth2 → URL Generator.</li>
              <li>
                Scopes: <code className="text-xs bg-muted px-1 rounded">bot</code> (add{" "}
                <code className="text-xs bg-muted px-1 rounded">applications.commands</code> if you use slash commands later).
              </li>
              <li>Select the bot permissions from the previous step.</li>
              <li>Copy the generated URL, open it in a browser, pick your server, authorize.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="roles">
          <AccordionTrigger>5. Role hierarchy (Instructor + bot)</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>Create an <strong>Instructor</strong> role for people who should run sessions and dashboard actions.</p>
            <p>
              The bot&apos;s highest role must be <strong>above</strong> any role it assigns. Typical order (top to bottom):
            </p>
            <ol className="list-decimal pl-5">
              <li>SessionBot (bot role)</li>
              <li>Instructor</li>
              <li>@everyone</li>
            </ol>
            <p className="text-xs">
              If Manage Roles is missing or the bot role is lower than Instructor, role commands will fail silently or with errors.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="student-role">
          <AccordionTrigger>6. Student role setup (attendance roster)</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>
              The bot can automatically populate the attendance roster from Discord members who have a <strong>Student</strong> role.
              This replaces manual student entry.
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Create a Discord role named <strong>Student</strong> in your server.</li>
              <li>Assign the Student role to all students in the course.</li>
              <li>Keep the <strong>Instructor</strong> role separate — instructors should not have the Student role unless they also attend as students.</li>
              <li>
                The bot needs <strong>Server Members Intent</strong> enabled in the Discord Developer Portal to scan members.
                This is already configured in the bot code.
              </li>
              <li>
                In the dashboard: <strong>Attendance → Roster → Sync from Discord</strong> to import all Student-role members.
              </li>
              <li>
                When a student uses <code className="text-xs bg-muted px-1 rounded">!checkin</code> or{" "}
                <code className="text-xs bg-muted px-1 rounded">!checkout</code>, the bot will automatically create a roster
                record for them if they have the Student role.
              </li>
            </ol>
            <p className="font-medium text-foreground">Environment variables</p>
            <pre className="text-xs bg-muted/60 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {`# In root .env
STUDENT_ROLE_NAME=Student
STUDENT_ROLE_IDS=`}
            </pre>
            <p className="text-xs">
              If <code className="bg-muted px-1 rounded">STUDENT_ROLE_IDS</code> is set (comma-separated role IDs), the bot
              uses those by default. Otherwise it falls back to matching by{" "}
              <code className="bg-muted px-1 rounded">STUDENT_ROLE_NAME</code>.
            </p>
            <p className="text-xs mt-2">
              <strong>Tip:</strong> You can skip setting these environment variables and instead choose the Student role directly from the dropdown in the <strong>Sync from Discord</strong> modal on the dashboard.
            </p>
            <p className="text-xs mt-2 text-muted-foreground">
              If no role is selected or configured, check-in/checkout works without role gating (backward compatible).
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="instructor-access">
          <AccordionTrigger>7. Instructor access</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>Add instructors by assigning the Instructor role in Discord, or from an admin account in Discord run:</p>
            <ul className="list-none pl-0 font-mono text-xs bg-muted/50 rounded-md p-3 space-y-1">
              <li>!add-instructor @User</li>
              <li>!remove-instructor @User</li>
            </ul>
            <p>Students typically only need basic self commands (e.g. help, whoami, my-attendance) depending on your bot configuration.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="env">
          <AccordionTrigger>8. Environment variables</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p className="font-medium text-foreground">Root <code className="text-xs">.env</code> (bot)</p>
            <pre className="text-xs bg-muted/60 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {`DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
BOT_API_PORT=4000
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/path/to/your/data.db
INSTRUCTOR_ROLE_NAME=Instructor
INSTRUCTOR_ROLE_IDS=
STUDENT_ROLE_NAME=Student
STUDENT_ROLE_IDS=
BOT_ADMIN_USER_IDS=`}
            </pre>
            <p className="font-medium text-foreground">Dashboard <code className="text-xs">.env.local</code></p>
            <pre className="text-xs bg-muted/60 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {`BOT_API_URL=http://127.0.0.1:4000/api
BOT_API_KEY=local_dashboard_key_123
DATABASE_PATH=C:/path/to/your/data.db
NEXT_PUBLIC_API_BASE=/api`}
            </pre>
            <p>
              Keep <code className="text-xs bg-muted px-1 rounded">BOT_API_KEY</code> identical on bot and dashboard. The dashboard never sends this key to the browser—only Next.js API routes use it server-side.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="run">
          <AccordionTrigger>9. Run locally</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Bot (repo root)</p>
            <pre className="text-xs bg-muted/60 rounded-md p-3">npm install{"\n"}node index.js</pre>
            <p className="font-medium text-foreground">Dashboard</p>
            <pre className="text-xs bg-muted/60 rounded-md p-3">cd dashboard{"\n"}pnpm install{"\n"}pnpm dev</pre>
            <p className="text-xs">If you use npm: <code className="bg-muted px-1 rounded">npm install</code> and <code className="bg-muted px-1 rounded">npm run dev</code> inside <code className="bg-muted px-1 rounded">dashboard/</code>.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="verify">
          <AccordionTrigger>10. Verify setup</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>Bot shows online in Discord</li>
              <li>Dashboard Home → Bot status Online, Database Connected</li>
              <li>Server dropdown in sidebar lists your guild</li>
              <li>Voice and text channels load on Record Session</li>
              <li>
                <Link href="/advanced/terminal" className="text-primary underline">
                  Command Terminal
                </Link>
                : <code className="text-xs bg-muted px-1 rounded">!help</code>, <code className="text-xs bg-muted px-1 rounded">!whoami</code>
              </li>
              <li>Record Session → start / schedule works</li>
              <li>Messages → send / schedule works</li>
              <li>End session → generate report → view report</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="troubleshoot">
          <AccordionTrigger>11. Troubleshooting</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <div>
              <p className="font-medium text-foreground">Bot offline</p>
              <p>Wrong token, bot not running, or intents disabled in the Developer Portal.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Dashboard cannot reach bot</p>
              <p>Wrong <code className="text-xs bg-muted px-1 rounded">BOT_API_URL</code>, API key mismatch, or bot HTTP server not started.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Cannot add instructor role via command</p>
              <p>Missing Manage Roles, or bot role is not above the Instructor role.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Wrong people can run instructor commands</p>
              <p>Check runtime permission checks, role assignments, and accidental Instructor role grants.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Channels not loading</p>
              <p>Bot not in server, missing View Channels, wrong guild selected, or cache not warm yet.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Scheduler surprises</p>
              <p>Bot must stay running; confirm timezone; confirm scheduled time is in the future.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Data looks wrong between bot and dashboard</p>
              <p>Ensure <code className="text-xs bg-muted px-1 rounded">DATABASE_PATH</code> points to the same SQLite file for both.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="demo">
          <AccordionTrigger>12. Live demo checklist</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Start bot → start dashboard</li>
              <li>Select server in sidebar</li>
              <li>Start session → end session</li>
              <li>Generate and open report</li>
              <li>Send a message and schedule another</li>
              <li>Review Activity and Participants</li>
            </ol>
            <p className="mt-2 text-xs">
              Command Terminal runs real bot commands through the server; use a test server first.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
