/**
 * What a model reads in tutorial/cms/Files/Documents/InvoiceSample.pdf — the sample invoice
 * that the Feature04 process passes to its agent. The simulation cannot open a PDF, so the
 * text of the document is kept here. Update it when the sample in the CMS changes.
 */
export const INVOICE_SAMPLE = `Invoice
Invoice Number: INV-0001-0002
Invoice Date: January 15, 2024
Due Date: February 14, 2024
Payment Terms: Net 30

From
Demo Company AG
Demo Street 123
0000 Demo City, Switzerland
VAT: CHE-000.000.000
Email: demo@example.com

Bill To
Sample Customer GmbH
Example Road 456
0000 Test Town, Switzerland
Contact: John Doe
Email: john.doe@example.com

Items
Description | Quantity | Unit Price (CHF) | Total (CHF)
Cloud Platform Subscription - Professional Plan (12 months) | 1 | 9,800.00 | 9,800.00
Custom Feature Development | 60 hrs | 160.00 | 9,600.00
System Integration Services | 1 | 4,200.00 | 4,200.00
Technical Documentation & Knowledge Transfer | 1 | 2,400.00 | 2,400.00
Managed Hosting Setup & Initial Configuration | 1 | 1,500.00 | 1,500.00

Summary
Subtotal 27,500.00
VAT (8.1%) 2,227.50
Total Due 29,727.50

Payment Instructions:
Bank: Demo Bank AG
IBAN: CF00 0000 0000 0000 0000 0
BIC: DEMOBANK00
Reference: REF-0001-0002
`;
