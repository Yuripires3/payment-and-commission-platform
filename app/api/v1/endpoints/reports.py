from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/commissions")
async def get_commission_report(
    competence: Optional[str] = None,
    product_id: Optional[str] = None,
    format: str = "json",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get commission report"""
    return ReportService.generate_commission_report(
        db=db,
        user=current_user,
        competence=competence,
        product_id=product_id,
        format=format
    )


@router.get("/analytics")
async def get_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics data"""
    return ReportService.get_analytics(
        db=db,
        user=current_user,
        start_date=start_date,
        end_date=end_date
    )
