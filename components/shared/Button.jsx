'use client';
export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 cursor-pointer border-0 outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#00338D] text-white hover:bg-[#002A73] focus:ring-[#00338D] shadow-sm hover:shadow-md active:scale-[0.98]',
    accent: 'bg-[#005EB8] text-white hover:bg-[#0088e0] focus:ring-[#005EB8] shadow-sm hover:shadow-md active:scale-[0.98]',
    outline: 'bg-transparent text-[#00338D] border-2 border-[#00338D] hover:bg-[#00338D] hover:text-white focus:ring-[#00338D] active:scale-[0.98]',
    ghost: 'bg-transparent text-[#6B7280] hover:bg-[#F0F2F5] hover:text-[#1A1F36] focus:ring-[#CBD5E1] active:scale-[0.98]',
    danger: 'bg-[#EF4444] text-white hover:bg-[#C8102E] focus:ring-[#EF4444] shadow-sm active:scale-[0.98]',
    amber: 'bg-[#E87722] text-white hover:bg-[#b8891a] focus:ring-[#E87722] shadow-sm active:scale-[0.98]',
    white: 'bg-white text-[#00338D] hover:bg-[#F0F2F5] focus:ring-white shadow-sm active:scale-[0.98]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
