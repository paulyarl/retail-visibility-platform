interface NavLinksProps {
  links: {
    dashboard: string;
    tenants: string;
    analytics?: string;
    settings: string;
  };
  tenantScopedLinksOn: boolean;
  className?: string;
  itemClassName?: string;
  onClick?: () => void;
}

/**
 * Shared navigation links component
 * Used by both desktop and mobile navigation
 */
export default function NavLinks({ 
  links, 
  tenantScopedLinksOn, 
  className = '', 
  itemClassName = '',
  onClick 
}: NavLinksProps) {
  return (
    <nav className={className}>
      <a 
        className={itemClassName} 
        href={links.dashboard}
        onClick={onClick}
      >
        Dashboard
      </a>
      <a 
        className={itemClassName} 
        href={links.tenants}
        onClick={onClick}
      >
        Tenants
      </a>
      {links.analytics && (
        <a 
          className={itemClassName} 
          href={links.analytics}
          onClick={onClick}
        >
          Analytics
        </a>
      )}
      <a 
        className={itemClassName} 
        href={links.settings}
        onClick={onClick}
      >
        Settings
      </a>
    </nav>
  );
}
