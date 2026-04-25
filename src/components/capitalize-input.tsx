"use client";

import { useState } from "react";

type CapitalizeInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
};

function capitalizeSegment(value: string) {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1).toLocaleLowerCase("fr-FR");
}

function formatCapitalizedName(value: string) {
  return value
    .split("-")
    .map((segment) => capitalizeSegment(segment))
    .join("-");
}

export function CapitalizeInput({
  name,
  defaultValue = "",
  placeholder,
  required,
  className,
  onValueChange,
}: Readonly<CapitalizeInputProps>) {
  const [value, setValue] = useState(formatCapitalizedName(defaultValue));

  return (
    <input
      name={name}
      value={value}
      onChange={(event) => {
        const nextValue = formatCapitalizedName(event.currentTarget.value);
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
