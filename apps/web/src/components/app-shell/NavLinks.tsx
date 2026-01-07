interface NavLinksProps {
  links: {
    dashboard: string;
    inventory: string;
    categories?: string;
    tenants: string;
    propagation?: string;
    integrations?: string;
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
        href={links.inventory}
        onClick={onClick}
      >
        Inventory
      </a>
      {links.categories && (
        <a 
          className={itemClassName} 
          href={links.categories}
          onClick={onClick}
        >
          Categories
        </a>
      )}
      <a 
        className={itemClassName} 
        href={links.tenants}
        onClick={onClick}
      >
        Tenants
      </a>
      {links.propagation && (
        <a 
          className={`${itemClassName} flex items-center gap-1.5`}
          href={links.propagation}
          onClick={onClick}
        >
          Propagation
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold">
            ORG
          </span>
        </a>
      )}
      {links.integrations && (
        <a 
          className={`${itemClassName} flex items-center gap-1.5`}
          href={links.integrations}
          onClick={onClick}
        >
          Integrations
          <span className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 text-white font-semibold">
              🟢
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold">
              🟦
            </span>
          </span>
        </a>
      )}
      <a 
        className={itemClassName} 
        href={links.settings}
        onClick={onClick}
      >
        {tenantScopedLinksOn ? 'Store Settings' : 'Settings'}
      </a>
    </nav>
  );
}
