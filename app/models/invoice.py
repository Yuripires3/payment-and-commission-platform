from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    ERROR = "error"
    RECONCILED = "reconciled"
    DIVERGENT = "divergent"


class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    partner_id = Column(String, ForeignKey("partners.id"), nullable=False)
    
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size = Column(Numeric(10, 0), nullable=False)
    
    competence = Column(String(7), nullable=False, index=True)  # YYYY-MM
    
    status = Column(SQLEnum(InvoiceStatus), nullable=False, default=InvoiceStatus.PENDING)
    
    total_amount = Column(Numeric(12, 2), nullable=True)
    total_commission = Column(Numeric(12, 2), nullable=True)
    
    processed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    partner = relationship("Partner", back_populates="invoices")
    commissions = relationship("Commission", back_populates="invoice")
    reconciliation = relationship("Reconciliation", back_populates="invoice", uselist=False)
