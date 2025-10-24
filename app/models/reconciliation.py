from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Reconciliation(Base):
    __tablename__ = "reconciliations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(String, ForeignKey("invoices.id"), unique=True, nullable=False)
    
    # Official report from operator/financial institution
    official_report_path = Column(String(500), nullable=True)
    
    # Reconciliation results
    is_reconciled = Column(Boolean, default=False)
    has_divergences = Column(Boolean, default=False)
    
    expected_amount = Column(Numeric(12, 2), nullable=True)
    actual_amount = Column(Numeric(12, 2), nullable=True)
    difference = Column(Numeric(12, 2), nullable=True)
    
    # Detailed divergences (JSON)
    divergences = Column(JSON, nullable=True)
    
    reconciled_at = Column(DateTime, nullable=True)
    reconciled_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="reconciliation")
