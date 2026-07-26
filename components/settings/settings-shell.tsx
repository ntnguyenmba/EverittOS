'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { isNavLinkActive, settingsLinksForRole } from '@/lib/nav-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalize