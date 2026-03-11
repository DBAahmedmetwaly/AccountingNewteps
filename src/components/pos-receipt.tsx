
"use client";

// استيراد React للسماح باستخدام JSX
import React, { useEffect, useRef } from 'react';
// استيراد مكتبة jsbarcode لإنشاء الباركود
import JsBarcode from 'jsbarcode';

// تعريف واجهة الخصائص (Props) لمكون قالب الفاتورة
export const PosReceipt = ({ invoice, company, design, warehouse, customer, customerBalance }: { invoice: any, company: any, design: any, warehouse?: any, customer?: any, customerBalance?: number }) => {
  
  // تعريف الأنماط المضمنة (Inline Styles) للتحكم الدقيق في شكل الطباعة
  const receiptStyle: React.CSSProperties = {
    width: `${design?.receiptWidth || 72}mm`, // عرض الإيصال بناءً على الإعدادات
    fontFamily: 'monospace, "Noto Kufi Arabic", sans-serif',
    fontSize: `${design?.fontSizes?.items || 10}px`,
    color: '#000',
    padding: '10px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    direction: 'rtl',
  };

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '10px',
  };

  const h1Style: React.CSSProperties = {
    margin: '0',
    fontSize: `${design?.fontSizes?.companyName || 16}px`,
    fontWeight: 'bold',
  };

  const pStyle: React.CSSProperties = {
    margin: '2px 0',
    fontSize: `${design?.fontSizes?.header || 12}px`,
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '10px',
    fontSize: `${design?.fontSizes?.items || 10}px`,
  };

  const thStyle: React.CSSProperties = {
    borderBottom: '1px dashed #000',
    padding: '4px 2px',
    textAlign: 'right',
  };

  const tdStyle: React.CSSProperties = {
    padding: '2px',
    verticalAlign: 'top',
  };

  const totalsStyle: React.CSSProperties = {
    marginTop: '10px',
    paddingTop: '5px',
    borderTop: '1px solid #000',
    fontSize: `${design?.fontSizes?.totals || 11}px`,
  };

  const footerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginTop: '15px',
    fontSize: `${design?.fontSizes?.items || 10}px`,
  };
  
  const barcodeValue = invoice.invoiceNumber || 'N/A';
  const items = invoice.items || invoice.cart || [];
  const payments = invoice.payments || [];
  const totalAmount = Number(invoice.total || 0);
  const paidAmount = Number(invoice.paidAmount ?? totalAmount);
  const remainingDue = Math.max(0, totalAmount - paidAmount);
  
  // مكون جديد لتوليد الباركود باستخدام SVG لضمان الدقة
  const BarcodeDisplay = ({ value, design }: { value: string, design: any }) => {
    const ref = React.useRef<SVGSVGElement>(null);

    React.useEffect(() => {
        if (ref.current) {
            try {
                JsBarcode(ref.current, value, {
                    format: "CODE128", 
                    height: 40,
                    displayValue: design.showCode,
                    fontSize: design.fontSizes.barcode || 10,
                    margin: 2,
                });
            } catch (e) {
                console.error("Barcode generation failed:", e);
            }
        }
    }, [value, design]);

    return <svg ref={ref} />;
  };

  const etaSettings = invoice.etaSettings;

  return (
    <div style={receiptStyle} className="bg-white text-black printable-area">
      {/* رأس الإيصال */}
      <div style={headerStyle}>
        {invoice.isCheck && <h2 style={{...h1Style, marginBottom: '10px', border: '1px solid black', padding: '4px'}}>شيك مبدئي</h2>}
        {design?.showLogo && company?.logoUrl && <img src={company.logoUrl} alt="logo" style={{ maxWidth: '80px', margin: '0 auto 5px' }} />}
        {design?.showCompanyName && <h1 style={h1Style}>{company?.companyName || 'اسم الشركة'}</h1>}
        {design?.showAddress && <p style={pStyle}>{company?.companyAddress || 'عنوان الشركة'}</p>}
        {design?.showPhoneNumber && <p style={pStyle}>{company?.phone || 'رقم الهاتف'}</p>}
        
        {/* ETA Header Info */}
        {etaSettings && (
          <div style={{ fontSize: '10px', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '5px' }}>
            {etaSettings.taxRegNumber && <p style={pStyle}>رقم التسجيل: {etaSettings.taxRegNumber}</p>}
            {etaSettings.branchCode && <p style={pStyle}>كود الفرع: {etaSettings.branchCode}</p>}
            {etaSettings.posDeviceSerial && <p style={pStyle}>الرقم التسلسلي: {etaSettings.posDeviceSerial}</p>}
          </div>
        )}

        <p style={pStyle}>فاتورة بيع</p>
        {invoice.isDelivery && <p style={{...pStyle, fontWeight: 'bold', fontSize: '14px', border: '1px solid black', padding: '2px', margin: '5px auto' }}>فاتورة توصيل (دليفري)</p>}
      </div>
      
      {/* معلومات الفاتورة */}
      <div style={{ borderBottom: '1px dashed #000', paddingBottom: '5px', marginBottom: '5px', fontSize: `${design?.fontSizes?.header || 12}px` }}>
        {design?.showInvoiceNumber && <p style={pStyle}>رقم: {invoice.invoiceNumber}</p>}
        {invoice.orderReference && <p style={{...pStyle, fontWeight: 'bold'}}>الطلب: {invoice.orderReference}</p>}
        <p style={pStyle}>التاريخ: {new Date(invoice.date).toLocaleString('ar-EG')}</p>
        {design?.showCashier && <p style={pStyle}>الكاشير: {invoice.cashierName}</p>}
        {customer && design?.showCustomerName && <p style={pStyle}>العميل: {customer.name}</p>}
        {customer && design?.showCustomerPhone && <p style={pStyle}>هاتف العميل: {customer.phone}</p>}
        {invoice.isDelivery && customer && customer.address && <p style={{...pStyle, fontWeight: 'bold'}}>العنوان: {customer.address}</p>}
      </div>
      
      {/* جدول الأصناف */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>الصنف</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>الكمية</th>
            {design?.showItemPrice && <th style={{ ...thStyle, textAlign: 'right' }}>السعر</th>}
            <th style={{ ...thStyle, textAlign: 'right' }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, index: number) => (
            <tr key={`${item.id}-${index}`}>
              <td style={tdStyle}>{item.name}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.qty}</td>
              {design?.showItemPrice && <td style={{ ...tdStyle, textAlign: 'right' }}>{item.price?.toFixed(2) || '0.00'}</td>}
              <td style={{ ...tdStyle, textAlign: 'right' }}>{item.total?.toFixed(2) || '0.00'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* قسم الإجماليات */}
      <div style={totalsStyle}>
        <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}><span>الإجمالي الفرعي:</span> <span>{(invoice.subtotal || 0).toFixed(2)}</span></p>
        {design?.showDiscount && <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}><span>الخصم:</span> <span>{(invoice.discount || 0).toFixed(2)}</span></p>}
        {design?.showTax && invoice.applyTax && (
          <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span>الضريبة {invoice.isTaxIncluded ? '(شاملة)' : `(${((invoice.taxRate || 0.14) * 100).toFixed(0)}%)`}:</span> 
            <span>{(invoice.taxAmount || invoice.tax || 0).toFixed(2)}</span>
          </p>
        )}
        <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '4px 0' }}><span>الإجمالي:</span> <span>{totalAmount.toFixed(2)}</span></p>
        <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}><span>إجمالي المدفوع:</span> <span>{paidAmount.toFixed(2)}</span></p>
        <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}><span>باقي المستحق على الفاتورة:</span> <span>{remainingDue.toFixed(2)}</span></p>
        
        {/* إجمالي مديونية العميل بالكامل */}
        {customerBalance !== undefined && (
            <p style={{ ...pStyle, display: 'flex', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '1px double #000', fontWeight: 'bold', color: '#d00' }}>
                <span>إجمالي مديونية العميل:</span>
                <span>{customerBalance.toFixed(2)} ج.م</span>
            </p>
        )}

        {payments.length > 0 && (
            <div style={{borderTop: '1px dashed #eee', marginTop: '5px', paddingTop: '5px'}}>
                 {payments.map((p: any, index: number) => (
                    <p key={p.id || index} style={{ ...pStyle, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.method}:</span>
                        <span>{p.amount.toFixed(2)}</span>
                    </p>
                 ))}
            </div>
        )}
      </div>

       {/* تذييل الإيصال والباركود */}
       <div style={footerStyle}>
         {design?.showBarcode && barcodeValue && (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', overflow: 'hidden', minHeight: '50px' }}>
                <BarcodeDisplay value={barcodeValue} design={design} />
            </div>
         )}
         {invoice.isCheck && <p style={{fontWeight: 'bold'}}>-- ليست فاتورة ضريبية --</p>}
        <p style={{marginTop: '10px'}}>{company?.invoiceFooter || 'شكرًا لتعاملكم معنا!'}</p>
      </div>
    </div>
  );
};
