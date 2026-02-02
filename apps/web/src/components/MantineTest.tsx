"use client";

import { Button, Card, TextInput, Badge, Group, Text, Stack } from "@mantine/core";

/**
 * Mantine Integration Test Component
 *
 * Verifies that Mantine components work correctly in our Next.js app
 * This component tests basic Mantine functionality and theming
 */
export function MantineTest() {
  return (
    <Card withBorder radius="md" padding="lg">
      <Card.Section withBorder inheritPadding py="xs">
        <Text fw={600} size="lg">
          Mantine Integration Test
        </Text>
      </Card.Section>

      <Stack gap="md" mt="md">
        <Text size="sm" c="dimmed">
          Testing Mantine components with our custom theme configuration
        </Text>

        <Group>
          <Badge color="blue" variant="light">
            Primary Blue
          </Badge>
          <Badge color="green" variant="light">
            Success Green
          </Badge>
          <Badge color="red" variant="light">
            Error Red
          </Badge>
          <Badge color="yellow" variant="light">
            Warning Yellow
          </Badge>
        </Group>

        <TextInput
          label="Test Input"
          placeholder="Type something..."
          description="Testing TextInput component"
        />

        <Group>
          <Button variant="filled" color="blue">
            Primary Button
          </Button>
          <Button variant="outline">
            Outline Button
          </Button>
          <Button variant="light">
            Light Button
          </Button>
        </Group>

        <Text size="sm" c="dimmed">
          ✅ If you can see styled buttons and inputs above, Mantine integration is working!
        </Text>
      </Stack>
    </Card>
  );
}
