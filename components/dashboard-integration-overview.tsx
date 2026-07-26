'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type IntegrationState = {
  label: string;
  detail: string;
  connected: boolean;
  attention: boolean;
};

const initialState: IntegrationState = {
  label: 'Checking...',
  detail: 'Loading connection status',
  connected: false,
  attention: false
};

async function readPayload(url: string): Promise<Record