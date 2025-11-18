import { Home, List, Shield } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  isAdmin: boolean;
}

export function AppSidebar({ isAdmin }: AppSidebarProps) {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  // Для админов показываем только админ панель
  // Для обычных пользователей показываем обычную навигацию
  const items = isAdmin
    ? [{ title: 'Админ Панель', url: '/admin', icon: Shield }]
    : [
        { title: 'Проверка номеров', url: '/checker', icon: Home },
        { title: 'Сохраненные номера', url: '/plates', icon: List },
      ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarContent className="bg-card">
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold text-card-foreground px-4">
            {open ? (isAdmin ? 'Управление' : 'Навигация') : '📋'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-base transition-colors hover:bg-accent text-card-foreground hover:text-accent-foreground"
                        activeClassName="bg-accent text-accent-foreground font-semibold"
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
