from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    PIX = "pix"
    BANK_TRANSFER = "bank_transfer"
    BOLETO = "boleto"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    partner_id = Column(String, ForeignKey("partners.id"), nullable=False)
    
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(SQLEnum(PaymentMethod), nullable=False)
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    
    competence = Column(String(7), nullable=False, index=True)  # YYYY-MM
    
    # PIX specific
    pix_key = Column(String(255), nullable=True)
    pix_txid = Column(String(255), nullable=True)
    pix_e2e_id = Column(String(255), nullable=True)
    
    # Bank transfer specific
    bank_code = Column(String(10), nullable=True)
    agency = Column(String(20), nullable=True)
    account = Column(String(20), nullable=True)
    
    # Receipt
    receipt_url = Column(String(500), nullable=True)
    receipt_generated_at = Column(DateTime, nullable=True)
    
    error_message = Column(Text, nullable=True)
    
    scheduled_for = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    commissions = relationship("Commission", back_populates="payment")
