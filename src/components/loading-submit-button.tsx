"use client";

import { useFormStatus } from "react-dom";

type LoadingSubmitButtonProps = {
  label: string;
  className: string;
  pendingLabel?: string;
};

export function LoadingSubmitButton({
  label,
  className,
  pendingLabel = "Chargement...",
}: Readonly<LoadingSubmitButtonProps>) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
