"use client";

import { useState } from "react";

type UppercaseInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function UppercaseInput({
  name,
  defaultValue = "",
  placeholder,
  required,
  className,
}: Readonly<UppercaseInputProps>) {
  const [value, setValue] = useState(defaultValue.toLocaleUpperCase("fr-FR"));

  return (
    <input
      name={name}
      value={value}
      onChange={(event) => {
        setValue(event.currentTarget.value.toLocaleUpperCase("fr-FR"));
      }}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
