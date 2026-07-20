import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  accountPasswordPolicyText,
  activationRequiredAppMetadata,
  isStrongActivationPassword
} from "../_shared/account-activation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const allowedRoles = new Set(["staff", "student", "guardian"]);
const allowedStatuses = new Set(["active", "inactive"]);
const accountAuthDomain = "accounts.chosmartialarts.app";
const allowedAccess = new Set([
  "dashboard",
  "messages",
  "students",
  "classes",
  "studyGuide",
  "events",
  "scheduling",
  "merchandise",
  "videos",
  "reports"
]);

type AccountRequest = {
  displayName?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  status?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  notes?: unknown;
  access?: unknown;
  studentId?: unknown;
  program?: unknown;
  beltRank?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function authEmailForUsername(username: string) {
  return `${username}@${accountAuthDomain}`;
}

function normalizeAccess(value: unknown, role: string) {
  if (role !== "staff" || !Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && allowedAccess.has(item)))];
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

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing manager session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid manager session." }, 401);

  const { data: callerProfile, error: callerProfileError } = await userClient
    .from("profiles")
    .select("id, username, role, status, is_owner")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    callerProfileError ||
    !callerProfile ||
    callerProfile.role !== "staff" ||
    callerProfile.status !== "active" ||
    callerProfile.is_owner !== true
  ) {
    return jsonResponse({ error: "Only an active Developer or Manager owner account can manage accounts." }, 403);
  }

  let body: AccountRequest;
  try {
    body = await req.json() as AccountRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const username = normalizeUsername(body.username);
  const displayName = cleanString(body.displayName);
  const password = cleanString(body.password);
  const role = allowedRoles.has(cleanString(body.role)) ? cleanString(body.role) : "";
  const status = allowedStatuses.has(cleanString(body.status)) ? cleanString(body.status) : "active";
  const contactEmail = cleanString(body.email).toLowerCase() || null;
  const phone = cleanString(body.phone) || null;
  const title = cleanString(body.title) || null;
  const notes = cleanString(body.notes) || null;
  const studentId = cleanString(body.studentId) || null;
  const program = cleanString(body.program) || "Youth Taekwondo";
  const beltRank = cleanString(body.beltRank) || "White";
  const access = normalizeAccess(body.access, role);
  const authEmail = authEmailForUsername(username);

  if (!username || username.length < 3 || !displayName || !password || !role) {
    return jsonResponse({ error: "Display name, username, temporary password, and role are required." }, 400);
  }
  if (!isStrongActivationPassword(password)) {
    return jsonResponse({ error: accountPasswordPolicyText }, 400);
  }
  if (username === "manager123" || username === "manager1" || username === "dev123" || username.endsWith(".child")) {
    return jsonResponse({ error: "That username is reserved." }, 400);
  }
  if (role === "student" && !studentId) {
    return jsonResponse({ error: "Student accounts require a linked student id." }, 400);
  }
  if (role === "student" && status !== "active") {
    return jsonResponse({ error: "New student accounts must start active." }, 400);
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .or(`username.eq.${username},auth_email.eq.${authEmail}`)
    .maybeSingle();

  if (existingProfileError) return jsonResponse({ error: "Could not check existing profiles." }, 500);
  if (existingProfile) return jsonResponse({ error: "An account with that username already exists." }, 409);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      role,
      display_name: displayName,
      ...(contactEmail ? { contact_email: contactEmail } : {})
    },
    app_metadata: activationRequiredAppMetadata({ role })
  });

  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: createUserError?.message ?? "Could not create the account." }, 400);
  }

  const profileRow = {
    id: createdUser.user.id,
    username,
    auth_email: authEmail,
    contact_email: contactEmail,
    display_name: displayName,
    role,
    status,
    is_owner: false,
    welcome_seen_at: null,
    invitation_status: "pending",
    invited_at: new Date().toISOString(),
    invitation_accepted_at: null,
    phone,
    title,
    notes,
    access,
    student_id: studentId,
    created_by: authData.user.id
  };
  const auditRow = {
    created_by: authData.user.id,
    created_user_id: createdUser.user.id,
    created_username: username,
    created_auth_email: authEmail,
    created_contact_email: contactEmail,
    created_role: role,
    request_ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent")
  };
  const today = new Date().toISOString().slice(0, 10);
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const studentRecord = role === "student"
    ? {
        id: studentId,
        firstName: nameParts[0] ?? displayName,
        lastName: nameParts.slice(1).join(" "),
        phone: "",
        email: "",
        enrollmentDate: today,
        program,
        status: status === "active" ? "Active" : "Inactive",
        beltRank,
        profileUpdatedAt: today,
        joinedAt: today,
        classesAttended: 0,
        missedClassCount: 0,
        ...(notes ? { notes } : {})
      }
    : null;

  const { error: provisionError } = await adminClient.rpc("provision_managed_account", {
    p_profile: profileRow,
    p_audit: auditRow,
    p_student_record: studentRecord
  });

  if (provisionError) {
    const { data: committedProfile, error: confirmationError } = await adminClient
      .from("profiles")
      .select("id, username, role, student_id")
      .eq("id", createdUser.user.id)
      .maybeSingle();
    if (confirmationError) {
      return jsonResponse({
        error: "Account provisioning could not be confirmed. The Auth user was preserved for administrator review."
      }, 503);
    }
    if (committedProfile) {
      if (
        committedProfile.username !== username
        || committedProfile.role !== role
        || (role === "student" && committedProfile.student_id !== studentId)
      ) {
        return jsonResponse({
          error: "Account provisioning returned conflicting committed data. The account was preserved for administrator review."
        }, 500);
      }
    } else {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdUser.user.id);
      if (rollbackError) {
        return jsonResponse({
          error: "Account provisioning failed and the incomplete Auth user could not be removed. Contact an administrator."
        }, 500);
      }
      return jsonResponse({ error: "Could not provision the account profile and linked records. No account was created." }, 500);
    }
  }

  return jsonResponse({
    email: authEmail,
    username,
    activationRequired: true,
    invitationStatus: "pending",
    student: studentRecord,
    account: {
      id: createdUser.user.id,
      username,
      role,
      status,
      invitationStatus: "pending"
    }
  });
});
