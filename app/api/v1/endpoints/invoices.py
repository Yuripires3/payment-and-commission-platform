from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.partner import Partner
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    competence: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload invoice file"""
    
    # Get partner
    partner = db.query(Partner).filter(Partner.user_id == current_user.id).first()
    if not partner and current_user.role == UserRole.PARTNER:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partner not found"
        )
    
    # Process upload
    result = await InvoiceService.process_upload(
        db=db,
        file=file,
        partner_id=partner.id if partner else None,
        competence=competence,
        uploaded_by=current_user.id
    )
    
    return result


@router.get("/")
async def list_invoices(
    competence: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List invoices"""
    return InvoiceService.list_invoices(
        db=db,
        user=current_user,
        competence=competence,
        status=status,
        skip=skip,
        limit=limit
    )
