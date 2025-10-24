import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const settings = await prisma.platformSettings.findUnique({
      where: { id: 1 },
      select: {
        platformName: true,
        platformDescription: true,
        logoUrl: true,
        faviconUrl: true,
      },
    });

    return NextResponse.json(settings || {});
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const platformName = formData.get('platformName') as string;
    const platformDescription = formData.get('platformDescription') as string;
    const logoFile = formData.get('logo') as File | null;
    const faviconFile = formData.get('favicon') as File | null;

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    let logoUrl: string | undefined;
    let faviconUrl: string | undefined;

    // Handle logo upload
    if (logoFile) {
      const bytes = await logoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `logo-${uuidv4()}${getFileExtension(logoFile.name)}`;
      const path = join(uploadDir, fileName);
      await writeFile(path, buffer);
      logoUrl = `/uploads/${fileName}`;
    }

    // Handle favicon upload
    if (faviconFile) {
      const bytes = await faviconFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `favicon-${uuidv4()}${getFileExtension(faviconFile.name)}`;
      const path = join(uploadDir, fileName);
      await writeFile(path, buffer);
      faviconUrl = `/uploads/${fileName}`;
    }

    // Update or create settings
    const data: any = {
      platformName,
      platformDescription,
      ...(logoUrl && { logoUrl }),
      ...(faviconUrl && { faviconUrl }),
    };

    await prisma.platformSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating branding settings:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}
