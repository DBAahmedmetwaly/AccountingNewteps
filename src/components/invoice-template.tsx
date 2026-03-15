import React, { useState } from 'react';
import Barcode from 'react-barcode';
import placeholderImages from "@/app/lib/placeholder-images.json";

interface InvoiceTemplateProps {
  invoice: any; 
  company: any; 
  customer?: any; 
  isPurchase?: boolean; 
  customerBalance?: number; 
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, company, customer, isPurchase = false, customerBalance }) => {
  const [imgError, setImgError] = useState(false);
  
  // 1. Better Logo Handling
  const logoUrl = company?.logoUrl && company.logoUrl !== "" && company.logoUrl !== "/logo.png"
    ? company.logoUrl 
    : "/logo.png";
    
  const receiptStyle: React.CSSProperties = {
    width: '210mm', 
    minHeight: '297mm', 
    fontFamily: '"Noto Kufi Arabic", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '14px',
    color: '#000', // Force black text
    padding: '20mm',
    boxSizing: 'border-box',
    direction: 'rtl', 
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff', // Force white background
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #000',
    paddingBottom: '15px',
    marginBottom: '25px'
  };
  
  const h1Style: React.CSSProperties = {
    margin: '0',
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#000'
  };

  const pStyle: React.CSSProperties = {
    margin: '3px 0',
    fontSize: '14px',
    color: '#000'
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '25px',
    fontSize: '14px',
    color: '#000',
    border: '1px solid #000'
  };

  const thStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '10px',
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold'
  };
  
  const tdStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '10px',
  };
  
   const totalsContainerStyle: React.CSSProperties = {
    alignSelf: 'flex-end',
    width: '50%',
    marginTop: '25px',
    fontSize: '14px',
    color: '#000'
  };

  const totalsRowStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid #ddd'
  }

  const footerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginTop: 'auto', 
    paddingTop: '20px',
    fontSize: '12px',
    borderTop: '1px solid #000',
    color: '#000'
  };

  const invoiceType = isPurchase ? 'فاتورة شراء' : 'فاتورة مبيعات ضريبية';
  const partyLabel = isPurchase ? 'المورد' : 'العميل';
  
  // Logic to get the most accurate names
  const effectivePartyName = customer?.name || invoice?.customerName || invoice?.supplierName || "عميل نقدي";
  const effectiveCompanyName = company?.companyName || "اسم شركتك";
  const effectiveCompanyAddress = company?.companyAddress || "عنوان الشركة";

  const canGenerateBarcode = (value: string) => /^[A-Za-z0-9\-]*$/.test(value);

  return (
    <div style={receiptStyle} className="bg-white text-black printable-area">
      <header style={headerStyle}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {!imgError && logoUrl ? (
                <img 
                    src={logoUrl} 
                    alt="Logo" 
                    crossOrigin="anonymous"
                    onError={() => setImgError(true)}
                    style={{ maxWidth: '120px', maxHeight: '100px', objectFit: 'contain' }} 
                />
            ) : (
                <div style={{ width: '100px', height: '100px', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>LOGO</span>
                </div>
            )}
            <div>
                <h1 style={h1Style}>{effectiveCompanyName}</h1>
                <p style={pStyle}>{effectiveCompanyAddress}</p>
            </div>
        </div>
        <div style={{textAlign: 'left'}}>
            <h2 style={{...h1Style, fontSize: '24px', marginBottom: '10px'}}>{invoiceType}</h2>
            <p style={pStyle}><strong>رقم الفاتورة:</strong> {invoice?.invoiceNumber}</p>
            <p style={pStyle}><strong>التاريخ:</strong> {invoice?.date ? new Date(invoice.date).toLocaleDateString('ar-EG') : '-'}</p>
        </div>
      </header>
      
      <div style={{marginBottom: '25px', padding: '15px', border: '1px solid #eee', borderRadius: '8px'}}>
        <h3 style={{borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '10px', fontWeight: 'bold'}}>بيانات {partyLabel}:</h3>
        <p style={pStyle}><strong>الاسم:</strong> {effectivePartyName}</p>
        {customer?.address && <p style={pStyle}><strong>العنوان:</strong> {customer.address}</p>}
        {(customer?.phone || invoice?.customerPhone) && <p style={pStyle}><strong>الهاتف:</strong> {customer?.phone || invoice?.customerPhone}</p>}
      </div>
      
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{...thStyle, width: '50px'}}>#</th>
            <th style={{...thStyle, textAlign: 'right'}}>الصنف</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>السعر</th>
            <th style={thStyle}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {(invoice?.items || []).map((item: any, index: number) => (
            <tr key={index}>
              <td style={{...tdStyle, textAlign: 'center'}}>{index + 1}</td>
              <td style={tdStyle}>{item.name}</td>
              <td style={{...tdStyle, textAlign: 'center'}}>{item.qty}</td>
              <td style={{...tdStyle, textAlign: 'center'}}>{(item.price || item.cost)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style={{...tdStyle, textAlign: 'center', fontWeight: 'bold'}}>{item.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={totalsContainerStyle}>
        <div style={totalsRowStyle}><span>الإجمالي الفرعي</span> <span>{(invoice?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={totalsRowStyle}><span>الخصم</span> <span>{(invoice?.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        {invoice?.tax > 0 && <div style={totalsRowStyle}><span>الضريبة (14%)</span> <span>{invoice.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
        <div style={{...totalsRowStyle, fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #000', paddingTop: '10px', marginTop: '5px' }}>
            <span>الإجمالي الكلي</span> 
            <span>{(invoice?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م</span>
        </div>
        <div style={totalsRowStyle}><span>المدفوع</span> <span>{(invoice?.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        
        {((invoice?.total || 0) - (invoice?.paidAmount || 0)) > 0.01 && (
            <div style={{...totalsRowStyle, fontWeight: 'bold', color: '#d00'}}>
                <span>باقي المستحق على الفاتورة</span> 
                <span>{((invoice?.total || 0) - (invoice?.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
        )}
        
        {!isPurchase && customerBalance !== undefined && (
            <div style={{...totalsRowStyle, marginTop: '15px', borderTop: '2px double #000', paddingTop: '10px', color: '#000', fontWeight: 'bold', backgroundColor: '#f9f9f9', padding: '10px' }}>
                <span>إجمالي المديونية السابقة والحالية</span>
                <span style={{color: '#d00'}}>{customerBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م</span>
            </div>
        )}
      </div>

       <footer style={footerStyle}>
         {invoice?.invoiceNumber && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '15px', minHeight: '50px' }}>
                {canGenerateBarcode(invoice.invoiceNumber) ? (
                    <Barcode value={invoice.invoiceNumber} height={40} width={1.5} fontSize={14} displayValue={false} />
                ) : (
                    <p style={{fontFamily: 'monospace', fontSize: '16px', border: '1px solid #000', padding: '5px 15px'}}>{invoice.invoiceNumber}</p>
                )}
            </div>
         )}
        <p style={{fontWeight: 'bold', fontSize: '14px'}}>{company?.invoiceFooter || 'شكرًا لتعاملكم معنا!'}</p>
      </footer>
    </div>
  );
};