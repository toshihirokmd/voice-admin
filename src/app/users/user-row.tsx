"use client";

import { useFormState } from "react-dom";
import {
  ActionResult,
  StatefulSaveButton,
} from "@/lib/forms/stateful-save-button";

type UserRole = {
  email: string;
  display_name: string | null;
  role: "admin" | "operator";
  created_at: string;
};

type UserAction = (
  prev: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;

export function UserRow({
  user,
  action,
}: {
  user: UserRole;
  action: UserAction;
}) {
  const [state, formAction] = useFormState<ActionResult, FormData>(
    action,
    null,
  );

  return (
    <tr className="border-t border-brand-border">
      <td className="py-3.5 px-3 font-mono text-xs text-brand-ink">{user.email}</td>
      <td className="py-3.5 px-3">
        <form action={formAction} className="flex gap-2 items-center">
          <input type="hidden" name="email" value={user.email} />
          <input
            name="display_name"
            defaultValue={user.display_name ?? ""}
            className="border border-brand-border rounded-lg bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf"
            placeholder="例: 山田太郎"
          />
          <select
            name="role"
            defaultValue={user.role}
            className="border border-brand-border rounded-lg bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf"
          >
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
          <StatefulSaveButton result={state} size="sm" />
        </form>
        {state?.ok === false && (
          <p className="mt-1 text-xs text-brand-sakura">{state.message}</p>
        )}
      </td>
      <td className="py-3.5 px-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            user.role === "admin"
              ? "bg-brand-green text-white"
              : "bg-brand-soft text-brand-green"
          }`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3.5 px-3 text-xs text-brand-sub">
        {new Date(user.created_at).toLocaleDateString("ja-JP", {
          timeZone: "Asia/Tokyo",
        })}
      </td>
      <td className="py-3.5 px-3"></td>
    </tr>
  );
}
