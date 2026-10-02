"use client";

import { Download } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseWorklaneAppId } from "@/modules/mcp/plugin-package";

export function PluginDownloadForm({
  defaultAppId,
  invalid,
}: {
  defaultAppId: string;
  invalid: boolean;
}) {
  const [appId, setAppId] = useState(defaultAppId);
  const [error, setError] = useState(
    invalid ? "That is not an app id. Copy the asdk_app_ value from the ChatGPT address." : "",
  );
  const [pending, setPending] = useState(false);
  const appIdOk = Boolean(parseWorklaneAppId(appId));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parseWorklaneAppId(appId)) {
      setError("That is not an app id. Copy the asdk_app_ value from the ChatGPT address.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/connect/plugin?app_id=${encodeURIComponent(appId.trim())}`);
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("zip")) {
        setError("That is not an app id. Copy the asdk_app_ value from the ChatGPT address.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "worklane.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("The plugin could not be downloaded. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2">
      <label htmlFor="app_id" className="text-sm font-medium text-foreground">
        App id
      </label>
      <Input
        id="app_id"
        name="app_id"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="asdk_app_…"
        value={appId}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => {
          setAppId(event.target.value);
          if (error) setError("");
        }}
        className="font-mono text-xs font-normal"
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : appIdOk ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The package name stays <span className="font-mono text-foreground">worklane</span>, which
          is the plugin already in ChatGPT. Only the app id changes.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          If the address shows plugin_asdk_app_, paste it as it is.
        </p>
      )}
      <Button type="submit" className="mt-2" disabled={pending}>
        <Download data-icon="inline-start" />
        {pending ? "Preparing plugin" : "Download plugin"}
      </Button>
    </form>
  );
}
