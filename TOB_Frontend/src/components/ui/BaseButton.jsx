import { Button } from 'antd'

const sizeMap = {
  sm: 'small',
  md: 'middle',
  lg: 'large',
}

const typeMap = {
  primary: 'primary',
  secondary: 'default',
  ghost: 'text',
  danger: 'danger',
}

export default function BaseButton({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <Button type={typeMap[variant]} size={sizeMap[size]} disabled={disabled} className={className} {...rest}>
      {children}
    </Button>
  )
}
