from celery import Task
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.invoice import Invoice, InvoiceStatus
from datetime import datetime


class DatabaseTask(Task):
    """Base task with database session"""
    _db = None
    
    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db
    
    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()


@celery_app.task(base=DatabaseTask, bind=True)
def process_invoice_task(self, invoice_id: str):
    """Process invoice file asynchronously"""
    
    db = self.db
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return {"error": "Invoice not found"}
    
    try:
        # Update status to processing
        invoice.status = InvoiceStatus.PROCESSING
        db.commit()
        
        # TODO: Implement actual processing logic
        # 1. Read file (CSV/XLSX/PDF)
        # 2. Parse data
        # 3. Validate data
        # 4. Create commission records
        # 5. Run reconciliation if official report exists
        
        # For now, just mark as processed
        invoice.status = InvoiceStatus.PROCESSED
        invoice.processed_at = datetime.utcnow()
        db.commit()
        
        return {"status": "success", "invoice_id": invoice_id}
        
    except Exception as e:
        invoice.status = InvoiceStatus.ERROR
        invoice.error_message = str(e)
        db.commit()
        
        return {"status": "error", "message": str(e)}
