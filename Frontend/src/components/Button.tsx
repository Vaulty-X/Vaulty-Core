import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading = false,
    disabled,
    className = '',
    ...props 
  }, ref) => {
    const baseStyles = 'relative rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variantStyles = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    }
    
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
    }
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {/* Always render children so layout stays stable; hide visually when loading */}
        <span aria-hidden={isLoading || undefined} className={isLoading ? 'invisible' : undefined}>{children}</span>

        {/* Visible loading text, also announced by screen readers via aria-live */}
        {isLoading && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            Loading, please wait
          </span>
        )}

        {/* Visible replacement text, hidden from AT (aria-busy on the button handles that) */}
        {isLoading && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            Loading...
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
