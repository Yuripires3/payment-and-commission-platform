from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.partner import Partner

router = APIRouter()


@router.get("/me")
async def get_my_partner_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current partner information"""
    partner = db.query(Partner).filter(Partner.user_id == current_user.id).first()
    return partner


@router.put("/me/banking")
async def update_banking_info(
    banking_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update partner banking information"""
    partner = db.query(Partner).filter(Partner.user_id == current_user.id).first()
    
    if "bank_code" in banking_data:
        partner.bank_code = banking_data["bank_code"]
    if "agency" in banking_data:
        partner.agency = banking_data["agency"]
    if "account" in banking_data:
        partner.account = banking_data["account"]
    if "pix_key" in banking_data:
        partner.pix_key = banking_data["pix_key"]
    if "pix_key_type" in banking_data:
        partner.pix_key_type = banking_data["pix_key_type"]
    
    db.commit()
    db.refresh(partner)
    
    return partner
