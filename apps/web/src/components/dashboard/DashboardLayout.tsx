/**
 * Dashboard Layout Component
 * 
 * Provides consistent layout for dashboard pages
 */

import React from 'react';
import { Container, Stack, Paper, Title } from '@mantine/core';

interface DashboardLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function DashboardLayout({ title, children }: DashboardLayoutProps) {
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Title order={1}>{title}</Title>
        {children}
      </Stack>
    </Container>
  );
}
