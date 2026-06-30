/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP Violation Reporting Endpoint
 * Receives and logs Content Security Policy violations
 *
 * This helps monitor potential XSS attempts and CSP misconfigurations
 */

interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri': string;
    'status-code': number;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

/**
 * POST /api/csp-report
 * Handles Content Security Policy (CSP) violation reports.
 * Logs the violation details for monitoring.
 * @param req - The incoming request containing the CSP report.
 * @returns 204 No Content response.
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw text first to handle both application/json and application/csp-report
    const body = await req.text();

    // Handle empty body (Swagger sometimes sends empty requests during OPTIONS/HEAD)
    if (!body || body.trim() === '') {
      return new NextResponse(null, { status: 204 });
    }

    // Try to parse as JSON
    let report: CSPViolationReport;
    try {
      report = JSON.parse(body);
    } catch (parseError) {
      console.error('[CSP] Failed to parse CSP report body:', { body, parseError });
      return new NextResponse(null, { status: 204 });
    }

    const violation = report['csp-report'];

    if (!violation) {
      console.warn('[CSP] Report missing csp-report field', { report });
      return new NextResponse(null, { status: 204 });
    }

    // Log CSP violation
    console.warn('[CSP] Violation Detected', {
      documentUri: violation['document-uri'],
      violatedDirective: violation['violated-directive'],
      effectiveDirective: violation['effective-directive'],
      blockedUri: violation['blocked-uri'],
      sourceFile: violation['source-file'],
      lineNumber: violation['line-number'],
      columnNumber: violation['column-number'],
      statusCode: violation['status-code'],
    });

    // In production, you might want to:
    // 1. Store violations in database
    // 2. Alert on repeated violations
    // 3. Analyze patterns for attacks
    // 4. Generate reports

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[CSP] Error processing CSP report:', error);
    // Return 204 instead of 400 to avoid console errors
    return new NextResponse(null, { status: 204 });
  }
}

// Prevent caching of CSP reports
export const dynamic = 'force-dynamic';
