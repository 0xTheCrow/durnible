import React, { type ReactElement } from 'react';

export function FloppyIcon(): ReactElement {
  return (
    <>
      <path
        d="M4 6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect
        x="8"
        y="4"
        width="6"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect
        x="7"
        y="13"
        width="10"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  );
}
