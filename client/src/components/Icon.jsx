// Custom icon component to use SVG icons from /icons/ folder
export default function Icon({ name, size = 16, className = '', style = {}, ...props }) {
  return (
    <img
      src={`/icons/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
      {...props}
    />
  );
}
