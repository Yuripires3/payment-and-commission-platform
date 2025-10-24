from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.commission import (
    CommissionResponse,
    CommissionUpdate,
    CommissionSimulation,
    CommissionSimulationResult
)
from app.models.user import User, UserRole
from app.models.commission import Commission
from app.models.partner import Partner
from app.services.commission_service import CommissionService

router = APIRouter()


@router.get("/", response_model=List[CommissionResponse])
async def list_commissions(
    competence: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List commissions"""
    query = db.query(Commission)
    
    # Filter by partner if not admin
    if current_user.role == UserRole.PARTNER:
        partner = db.query(Partner).filter(Partner.user_id == current_user.id).first()
        if partner:
            query = query.filter(Commission.partner_id == partner.id)
    
    if competence:
        query = query.filter(Commission.competence == competence)
    if status:
        query = query.filter(Commission.status == status)
    
    commissions = query.offset(skip).limit(limit).all()
    return commissions


@router.get("/dashboard")
async def get_commission_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get commission dashboard data"""
    partner = db.query(Partner).filter(Partner.user_id == current_user.id).first()
    
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partner not found"
        )
    
    return CommissionService.get_dashboard_data(db, partner.id)


@router.post("/simulate", response_model=CommissionSimulationResult)
async def simulate_commission(
    simulation: CommissionSimulation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Simulate commission calculation"""
    return CommissionService.simulate_commission(
        db=db,
        product_id=simulation.product_id,
        base_amount=simulation.base_amount,
        competence=simulation.competence
    )


@router.put("/{commission_id}", response_model=CommissionResponse)
async def update_commission(
    commission_id: str,
    commission_update: CommissionUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.FINANCIAL)),
    db: Session = Depends(get_db)
):
    """Update commission (admin/financial only)"""
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    
    if not commission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commission not found"
        )
    
    if commission_update.status:
        commission.status = commission_update.status
    if commission_update.adjustment_amount is not None:
        commission.adjustment_amount = commission_update.adjustment_amount
        commission.adjustment_reason = commission_update.adjustment_reason
        commission.adjusted_by = current_user.id
    
    db.commit()
    db.refresh(commission)
    
    return commission
