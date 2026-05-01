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
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-xs">{user.email}</td>
      <td className="px-3 py-2">
        <form action={formAction} className="flex gap-2 items-center">
          <input type="hidden" name="email" value={user.email} />
          <input
            name="display_name"
            defaultValue={user.display_name ?? ""}
            className="border rounded px-2 py-1 text-sm"
            placeholder="例: 山田太郎"
          />
          <select
            name="role"
            defaultValue={user.role}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
          <StatefulSaveButton result={state} size="sm" />
        </form>
        {state?.ok === false && (
          <p className="mt-1 text-xs text-red-600">{state.message}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-200">
          {user.role}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {new Date(user.created_at).toLocaleDateString("ja-JP", {
          timeZone: "Asia/Tokyo",
        })}
      </td>
      <td className="px-3 py-2"></td>
    </tr>
  );
}
