import React from 'react';

export function Button({ children, className = '', type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`btn ${className}`} {...props}>
      {children}
    </button>
  );
}
