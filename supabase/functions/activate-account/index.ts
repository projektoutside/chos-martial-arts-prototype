import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  activatedAppMetadata,
  requiresPasswordChange,
  validateActivationPassword
} from "../_shared/account-activation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase function secrets are not configured." }, 500);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing temporary session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const passwordClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid temporary session." }, 401);

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") {
    return jsonResponse({ error: "This account cannot be activated." }, 403);
  }
  if (!requiresPasswordChange(authData.user.app_metadata)) {
    return jsonResponse({ error: "This account is already active. Use Sign In." }, 409);
  }

  let body: { newPassword?: unknown; temporaryPassword?: unknown };
  try {
    body = await req.json() as { newPassword?: unknown; temporaryPassword?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
  const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword.trim() : "";
  const validationMessage = validateActivationPassword(newPassword, temporaryPassword);
  if (validationMessage) return jsonResponse({ error: validationMessage }, 400);
  if (!authData.user.email) return jsonResponse({ error: "This account cannot be activated." }, 403);

  const { error: passwordError } = await passwordClient.auth.signInWithPassword({
    email: authData.user.email,
    password: temporaryPassword
  });
  if (passwordError) return jsonResponse({ error: "Check the account name and temporary password." }, 401);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
    password: newPassword,
    app_metadata: activatedAppMetadata(authData.user.app_metadata)
  });
  if (updateError) return jsonResponse({ error: updateError.message }, 400);

  const { error: invitationError } = await adminClient
    .from("profiles")
    .update({
      invitation_status: "accepted",
      invitation_accepted_at: new Date().toISOString()
    })
    .eq("id", authData.user.id);

  return jsonResponse({
    status: "ok",
    invitationStatus: invitationError ? "pending" : "accepted"
  });
});
