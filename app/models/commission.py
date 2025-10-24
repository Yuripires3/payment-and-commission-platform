from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class CommissionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class Commission(Base):
    __tablename__ = "commissions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    partner_id = Column(String, ForeignKey("partners.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)
    
    competence = Column(String(7), nullable=False, index=True)  # YYYY-MM
    
    base_amount = Column(Numeric(12, 2), nullable=False)
    commission_amount = Column(Numeric(12, 2), nullable=False)
    
    status = Column(SQLEnum(CommissionStatus), nullable=False, default=CommissionStatus.PENDING)
    
    # Manual adjustments
    adjustment_amount = Column(Numeric(12, 2), nullable=True, default=0)
    adjustment_reason = Column(Text, nullable=True)
    adjusted_by = Column(String, ForeignKey("users.id"), nullable=True)
    adjusted_at = Column(DateTime, nullable=True)
    
    # Approval
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Payment
    payment_id = Column(String, ForeignKey("payments.id"), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    partner = relationship("Partner", back_populates="commissions")
    product = relationship("Product", back_populates="commissions")
    invoice = relationship("Invoice", back_populates="commissions")
    payment = relationship("Payment", back_populates="commissions")
