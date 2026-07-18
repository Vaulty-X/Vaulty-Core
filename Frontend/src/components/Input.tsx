import { InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className = '', id: propsId, ...props }, ref) => {
    const generatedId = useId()
    const id = propsId || generatedId
    const errorId = `${id}-error`
    const helpId = `${id}-help`

    const describedByIds = []
    if (helpText) describedByIds.push(helpId)
    if (error) describedByIds.push(errorId)

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedByIds.length ? describedByIds.join(' ') : undefined}
          aria-errormessage={error ? errorId : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            error ? 'border-red-500' : 'border-slate-300'
          } ${className}`}
          {...props}
        />
        {helpText && !error && (
          <p id={helpId} className="mt-1 text-sm text-slate-500">
            {helpText}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
