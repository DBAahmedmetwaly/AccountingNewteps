
import React, { useState } from 'react';
import Barcode from 'react-barcode';

interface InvoiceTemplateProps {
  invoice: any; 
  company: any; 
  customer?: any; 
  isPurchase?: boolean; 
  customerBalance?: number; 
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, company, customer, isPurchase = false, customerBalance }) => {
  const [imgError, setImgError] = useState(false);
    
  const receiptStyle: React.CSSProperties = {
    width: '210mm', 
    minHeight: '297mm', 
    fontFamily: '"Noto Kufi Arabic", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    color: '#000',
    padding: '20mm',
    boxSizing: 'border-box',
    direction: 'rtl', 
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #000',
    paddingBottom: '10px',
    marginBottom: '20px'
  };
  
  const h1Style: React.CSSProperties = {
    margin: '0',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#000'
  };

  const pStyle: React.CSSProperties = {
    margin: '2px 0',
    fontSize: '12px',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
    fontSize: '12px',
  };

  const thStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'center',
    backgroundColor: '#f2f2f2'
  };
  
  const tdStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    padding: '8px',
  };
  
   const totalsContainerStyle: React.CSSProperties = {
    alignSelf: 'flex-end',
    width: '45%',
    marginTop: '20px',
    fontSize: '12px',
  };

  const totalsRowStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: '1px solid #eee'
  }

  const footerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginTop: 'auto', 
    paddingTop: '20px',
    fontSize: '11px',
    borderTop: '1px solid #ccc'
  };

  const invoiceType = isPurchase ? 'فاتورة شراء' : 'فاتورة بيع';
  const partyLabel = isPurchase ? 'المورد' : 'العميل';
  const partyName = customer?.name || (isPurchase ? invoice.supplierName : invoice.customerName);
  
  const canGenerateBarcode = (value: string) => /^[A-Za-z0-9\-]*$/.test(value);

  return (
    <div style={receiptStyle} className="bg-white text-black printable-area">
      <header style={headerStyle}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {company?.logoUrl && !imgError && (
                <img 
                    src={company.logoUrl} 
                    alt="Logo" 
                    crossOrigin="anonymous"
                    onError={() => setImgError(true)}
                    style={{ maxWidth: '100px', maxHeight: '80px', objectFit: 'contain' }} 
                />
            )}
            <div>
                <h1 style={h1Style}>{company?.companyName || 'اسم الشركة'}</h1>
                <p style={pStyle}>{company?.companyAddress || 'عنوان الشركة'}</p>
            </div>
        </div>
        <div style={{textAlign: 'left'}}>
            <h2 style={{...h1Style, fontSize: '20px', marginBottom: '10px'}}>{invoiceType}</h2>
            <p style={pStyle}><strong>رقم:</strong> {invoice.invoiceNumber}</p>
            <p style={pStyle}><strong>التاريخ:</strong> {new Date(invoice.date).toLocaleDateString('ar-EG')}</p>
        </div>
      </header>
      
      <div style={{marginBottom: '20px'}}>
        <h3 style={{borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px'}}>بيانات {partyLabel}:</h3>
        <p style={pStyle}><strong>الاسم:</strong> {partyName}</p>
        {customer?.address && <p style={pStyle}><strong>العنوان:</strong> {customer.address}</p>}
        {customer?.phone && <p style={pStyle}><strong>الهاتف:</strong> {customer.phone}</p>}
      </div>
      
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={{...thStyle, width: '40%'}}>الصنف</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>سعر الوحدة</th>
            <th style={thStyle}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item: any, index: number) => (
            <tr key={index}>
              <td style={{...tdStyle, textAlign: 'center'}}>{index + 1}</td>
              <td style={tdStyle}>{item.name}</td>
              <td style={{...tdStyle, textAlign: 'center'}}>{item.qty}</td>
              <td style={{...tdStyle, textAlign: 'right'}}>{(item.cost || item.price)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style={{...tdStyle, textAlign: 'right'}}>{item.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={totalsContainerStyle}>
        <div style={totalsRowStyle}><span>الإجمالي الفرعي</span> <span>{invoice.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={totalsRowStyle}><span>الخصم</span> <span>{invoice.discount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={totalsRowStyle}><span>الضريبة (14%)</span> <span>{invoice.tax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={{...totalsRowStyle, fontWeight: 'bold', fontSize: '14px', borderTop: '2px solid #000', paddingTop: '10px' }}><span>الإجمالي</span> <span>{invoice.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={totalsRowStyle}><span>المدفوع</span> <span>{invoice.paidAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div style={{...totalsRowStyle, fontWeight: 'bold'}}><span>باقي المستحق على هذه الفاتورة</span> <span>{(invoice.total - (invoice.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        
        {!isPurchase && customerBalance !== undefined && (
            <div style={{...totalsRowStyle, marginTop: '10px', borderTop: '1px double #000', paddingTop: '5px', color: '#d00', fontWeight: 'bold' }}>
                <span>إجمالي المديونية السابقة والحالية</span>
                <span>{customerBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م</span>
            </div>
        )}
      </div>

       <footer style={footerStyle}>
         {invoice.invoiceNumber && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '10px', minHeight: '40px' }}>
                {canGenerateBarcode(invoice.invoiceNumber) ? (
                    <Barcode value={invoice.invoiceNumber} height={40} displayValue={false} />
                ) : (
                    <p style={{fontFamily: 'monospace', fontSize: '14px'}}>{invoice.invoiceNumber}</p>
                )}
            </div>
         )}
        <p>{company?.invoiceFooter || 'شكرًا لتعاملكم معنا!'}</p>
      </footer>
    </div>
  );
};
