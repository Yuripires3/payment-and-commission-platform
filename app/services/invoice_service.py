from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from typing import Optional
import os
import uuid
from datetime import datetime

from app.models.invoice import Invoice, InvoiceStatus
from app.models.partner import Partner
from app.models.user import User, UserRole
from app.core.config import settings
from app.tasks.invoice_tasks import process_invoice_task


class InvoiceService:
    @staticmethod
    async def process_upload(
        db: Session,
        file: UploadFile,
        partner_id: Optional[str],
        competence: Optional[str],
        uploaded_by: str
    ):
        """Process invoice file upload"""
        
        # Validate file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed"
            )
        
        # Validate file size
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if file_size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed"
            )
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = f"invoices/{competence or 'unknown'}/{unique_filename}"
        
        # TODO: Upload to S3 or local storage
        # For now, just save the path
        
        # Create invoice record
        invoice = Invoice(
            partner_id=partner_id,
            file_name=file.filename,
            file_path=file_path,
            file_type=file_ext,
            file_size=file_size,
            competence=competence or datetime.now().strftime("%Y-%m"),
            status=InvoiceStatus.PENDING,
            uploaded_by=uploaded_by
        )
        
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        
        # Queue processing task
        process_invoice_task.delay(invoice.id)
        
        return {
            "invoice_id": invoice.id,
            "status": invoice.status,
            "message": "Invoice uploaded successfully and queued for processing"
        }
    
    @staticmethod
    def list_invoices(
        db: Session,
        user: User,
        competence: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ):
        """List invoices"""
        query = db.query(Invoice)
        
        # Filter by partner if not admin
        if user.role == UserRole.PARTNER:
            partner = db.query(Partner).filter(Partner.user_id == user.id).first()
            if partner:
                query = query.filter(Invoice.partner_id == partner.id)
        
        if competence:
            query = query.filter(Invoice.competence == competence)
        if status:
            query = query.filter(Invoice.status == status)
        
        invoices = query.order_by(Invoice.uploaded_at.desc()).offset(skip).limit(limit).all()
        return invoices
