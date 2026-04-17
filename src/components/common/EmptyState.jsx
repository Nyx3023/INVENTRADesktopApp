import { InboxIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';

/**
 * Reusable empty state for tables, lists, and data panels.
 *
 * @param {Object} props
 * @param {React.ComponentType<{className?: string}>} [props.icon]   - Heroicon component (optional).
 * @param {string} props.title                                      - Main heading, e.g. "No products found".
 * @param {string} [props.description]                              - Subtext with guidance or context.
 * @param {React.ReactNode} [props.action]                          - Optional primary action (usually a <button>).
 * @param {React.ReactNode} [props.secondaryAction]                 - Optional secondary action.
 * @param {'default'|'compact'|'inline'} [props.size]               - 'compact' for table rows, 'inline' for tight areas.
 * @param {string} [props.className]
 */
const EmptyState = ({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  className = '',
}) => {
  const { colors } = useTheme();

  const sizing = size === 'compact'
    ? {
        wrap: 'py-10 px-4',
        iconWrap: 'h-12 w-12 mb-3',
        iconClass: 'h-6 w-6',
        titleClass: 'text-base font-semibold',
        descClass: 'text-xs',
      }
    : size === 'inline'
    ? {
        wrap: 'py-6 px-3',
        iconWrap: 'h-10 w-10 mb-2',
        iconClass: 'h-5 w-5',
        titleClass: 'text-sm font-semibold',
        descClass: 'text-xs',
      }
    : {
        wrap: 'py-16 px-6',
        iconWrap: 'h-16 w-16 mb-4',
        iconClass: 'h-8 w-8',
        titleClass: 'text-lg font-semibold',
        descClass: 'text-sm',
      };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizing.wrap} ${className}`}>
      <div className={`rounded-full flex items-center justify-center ${sizing.iconWrap} ${colors.bg.tertiary}`}>
        <Icon className={`${sizing.iconClass} ${colors.text.tertiary}`} />
      </div>
      <h3 className={`${sizing.titleClass} ${colors.text.primary}`}>{title}</h3>
      {description && (
        <p className={`mt-1 max-w-sm ${sizing.descClass} ${colors.text.secondary}`}>{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
