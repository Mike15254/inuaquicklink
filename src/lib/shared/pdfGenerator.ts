import { jsPDF } from 'jspdf';

export interface LoanApplicationData {
  // Personal Information
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  nationalId: string;
  kraPin: string;
  residentialAddress: string;
  
  // Employment Details
  employerName: string;
  employerLocation: string;
  netSalary: string;
  nextSalaryPayDate: string;
  
  // Loan Details
  loanPurpose: string;
  requestedAmount: string;
  disbursementMethod: string;
  mpesaNumber?: string;
  bankName?: string;
  bankAccount?: string;
  accountName?: string;
  
  // Loan Summary
  loanAmount: number;
  interestAmount: number;
  processingFee: number;
  totalAmount: number;
  repaymentDate: string;
  daysToDueDate: number;
  
  // Digital Signature
  digitalSignature: string;
  applicationDate: string;
  applicationId?: string;
}

export interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  paybill?: string;
  bankName?: string;
  account_number?: string;
  logoUrl?: string;
}

export function generateLoanApplicationPDF(
  applicationData: LoanApplicationData, 
  companyInfo: CompanyInfo
): jsPDF {
  const doc = new jsPDF();
  
  // Set up document properties
  doc.setProperties({
    title: 'Loan Application Summary',
    subject: 'Loan Application',
    author: companyInfo.name,
    creator: companyInfo.name
  });

  let currentY = 20;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Header Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.name, margin, currentY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  currentY += 8;
  doc.text(`Email: ${companyInfo.email}`, margin, currentY);

  // Title - Center
  currentY += 10;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = 'LOAN APPLICATION SUMMARY';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, currentY);
  
  // Horizontal line
  currentY += 10;
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // Application Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICATION INFORMATION', margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Two-column layout for basic info
  const leftColumnX = margin;
  
  doc.text('Application Date:', leftColumnX, currentY);
  doc.text(applicationData.applicationDate, leftColumnX + 35, currentY);
  

  currentY += 10;

  // Personal Information Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PERSONAL INFORMATION', margin, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const personalInfo = [
    ['Full Name:', `${applicationData.firstName} ${applicationData.middleName || ''} ${applicationData.lastName}`.trim()],
    ['Email Address:', applicationData.email],
    ['Phone Number:', applicationData.phoneNumber],
    ['National ID:', applicationData.nationalId],
    ['KRA PIN:', applicationData.kraPin],
    ['Residential Address:', applicationData.residentialAddress]
  ];

  personalInfo.forEach(([label, value]) => {
    doc.text(label, leftColumnX, currentY);
    // Handle long text wrapping
    const textLines = doc.splitTextToSize(value, contentWidth - 50);
    doc.text(textLines, leftColumnX + 45, currentY);
    currentY += textLines.length * 5 + 3;
    
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
  });

  currentY += 5;

  // Employment Information Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYMENT INFORMATION', margin, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const employmentInfo = [
    ['Employer Name:', applicationData.employerName],
    ['Employer Location:', applicationData.employerLocation],
    ['Net Salary:', `KES ${parseCurrencyString(applicationData.netSalary).toLocaleString('en-KE')}`],
    ['Next Salary Pay Date:', applicationData.nextSalaryPayDate]
  ];

  employmentInfo.forEach(([label, value]) => {
    doc.text(label, leftColumnX, currentY);
    doc.text(value, leftColumnX + 45, currentY);
    currentY += 8;

    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
  });

  currentY += 5;

  // Loan Information Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LOAN INFORMATION', margin, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const loanInfo = [
    ['Loan Purpose:', applicationData.loanPurpose],
    ['Requested Amount:', `KES ${parseCurrencyString(applicationData.requestedAmount).toLocaleString('en-KE')}`],
    ['Loan Period:', `${applicationData.daysToDueDate} days`],
    ['Repayment Date:', applicationData.repaymentDate],
    ['Disbursement Method:', applicationData.disbursementMethod === 'mpesa' ? 'M-Pesa' : 'Bank Transfer']
  ];

  if (applicationData.disbursementMethod === 'mpesa' && applicationData.mpesaNumber) {
    loanInfo.push(['M-Pesa Number:', applicationData.mpesaNumber]);
  } else if (applicationData.disbursementMethod === 'bank_transfer') {
    loanInfo.push(['Bank Name:', applicationData.bankName || '']);
    loanInfo.push(['Account Number:', applicationData.bankAccount || '']);
    loanInfo.push(['Account Name:', applicationData.accountName || '']);
  }

  loanInfo.forEach(([label, value]) => {
    doc.text(label, leftColumnX, currentY);
    doc.text(value, leftColumnX + 45, currentY);
    currentY += 5;

    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
  });

  // Check if we need a new page
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  currentY += 5;

  // Loan Summary Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LOAN SUMMARY', margin, currentY);
  currentY += 5;

  // Create a table-like structure for loan summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Table headers
  const tableStartY = currentY;
  const rowHeight = 15;
  const col1X = margin;
  const col2X = margin + 80;
  const col3X = margin + 160;

  // Draw table borders
  doc.rect(margin, tableStartY, contentWidth, rowHeight * 5);
  
  // Header row
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, tableStartY, contentWidth, rowHeight);
  doc.text('DESCRIPTION', col1X + 5, tableStartY + 10);
  doc.text('AMOUNT (KES)', col2X + 5, tableStartY + 10);

  currentY = tableStartY + rowHeight;
  doc.setFont('helvetica', 'normal');

  // Loan amount row
  doc.rect(margin, currentY, contentWidth, rowHeight);
  doc.text('Principal Amount', col1X + 5, currentY + 10);
  doc.text(applicationData.loanAmount.toLocaleString('en-KE'), col2X + 5, currentY + 10);

  currentY += rowHeight;
  
  // Interest row
  doc.rect(margin, currentY, contentWidth, rowHeight);
  doc.text(`Interest`, col1X + 5, currentY + 10);
  doc.text(applicationData.interestAmount.toLocaleString('en-KE'), col2X + 5, currentY + 10);

  currentY += rowHeight;
  
  // Processing fee row
  doc.rect(margin, currentY, contentWidth, rowHeight);
  doc.text('Processing Fee', col1X + 5, currentY + 10);
  doc.text(applicationData.processingFee.toLocaleString('en-KE'), col2X + 5, currentY + 10);

  currentY += rowHeight;
  
  // Total row (highlighted)
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, currentY, contentWidth, rowHeight);
  doc.text('TOTAL REPAYMENT', col1X + 5, currentY + 10);
  doc.text(applicationData.totalAmount.toLocaleString('en-KE'), col2X + 5, currentY + 10);

  currentY += rowHeight + 5;

  // Disbursement amount info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const disbursementAmount = applicationData.loanAmount - applicationData.processingFee;
  doc.text(`Disbursement Amount: KES ${disbursementAmount.toLocaleString('en-KE')}`, margin, currentY);
  doc.text('(Processing fee deducted at disbursement)', margin, currentY + 8);

  // Documents Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBMITTED DOCUMENTS', margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const documents = [
    '✓ National ID (Front)',
    '✓ National ID (Back)', 
    '✓ Passport Photo',
    '✓ Latest Payslip',
    '✓ Previous Payslip',
    '✓ Post-Dated Check (MANDATORY)'
  ];

  documents.forEach(doc_item => {
    doc.text(doc_item, margin, currentY);
    currentY += 8;

    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
  });

  currentY += 5;

  // Digital Signature Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL SIGNATURE', margin, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Applicant Signature:', margin, currentY);
  doc.text(applicationData.digitalSignature, margin + 45, currentY);
  
  currentY += 8;
  doc.text('Date:', margin, currentY);
  doc.text(applicationData.applicationDate, margin + 45, currentY);

  currentY += 10;

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const footerText = 'This is a computer-generated agreement.';
  const footerWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerWidth) / 2, currentY);

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string = 'loan-application.pdf'): void {
  doc.save(filename);
}

export function getPDFBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}

function parseCurrencyString(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remove all non-numeric characters except dot
  const cleaned = value.toString().replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}