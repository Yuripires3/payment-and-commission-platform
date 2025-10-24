from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.models.commission import CommissionStatus


class CommissionBase(BaseModel):
    partner_id: str
    product_id: str
    competence: str
    base_amount: Decimal
    commission_amount: Decimal


class CommissionCreate(CommissionBase):
    invoice_id: Optional[str] = None


class CommissionUpdate(BaseModel):
    status: Optional[CommissionStatus] = None
    adjustment_amount: Optional[Decimal] = None
    adjustment_reason: Optional[str] = None


class CommissionResponse(CommissionBase):
    id: str
    status: CommissionStatus
    adjustment_amount: Optional[Decimal] = None
    adjustment_reason: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class CommissionSimulation(BaseModel):
    product_id: str
    base_amount: Decimal
    competence: str
    
    
class CommissionSimulationResult(BaseModel):
    product_id: str
    product_name: str
    base_amount: Decimal
    commission_amount: Decimal
    commission_type: str
    rule_applied: dict
