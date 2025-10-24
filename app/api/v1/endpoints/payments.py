from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.payment import Payment
from app.services.payment_service import PaymentService

router = APIRouter()


@router.get("/")
async def list_payments(
    competence: str = None,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List payments"""
    return PaymentService.list_payments(
        db=db,
        user=current_user,
        competence=competence,
        skip=skip,
        limit=limit
    )


@router.post("/process")
async def process_payments(
    competence: str,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.FINANCIAL)),
    db: Session = Depends(get_db)
):
    """Process payments for a competence (admin/financial only)"""
    return PaymentService.process_payments(db=db, competence=competence)
