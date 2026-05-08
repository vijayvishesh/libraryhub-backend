import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import {
  LibraryFacility,
  LibraryPaymentMethod,
  LibrarySlotType,
} from '../constants/library.constants';

export type LibraryLocation = {
  type: 'Point';
  coordinates: [number, number];
};

export type LibrarySlot = {
  slotType: LibrarySlotType;
  name: string;
  startTime: string;
  endTime: string;
  pricePerMonth: number;
  isActive: boolean;
  plans?: LibrarySlotPlan[];   
  trials?: LibrarySlotTrial[];
};

export type LibraryPhoto = {
  url: string;
  publicId: string | null;
  order: number;
  uploadedAt: Date;
};

export type LibrarySeatingRange = {
  from: number;
  to: number;
  gender: 'any' | 'male' | 'female';
};

export type LibrarySeatingSection = {
  id: number;
  name: string;
  capacity: number;
  filled: number;
  available: number;
  gender: 'any' | 'male' | 'female';
};

export type LibrarySeating = {
  mode: 'general' | 'section';
  total: number;
  filled: number;
  available: number;
  arrangement?: 'open' | 'split' | 'custom';
  boys?: number;
  girls?: number;
  open?: number;
  ranges?: LibrarySeatingRange[];
  genderMode?: 'mixed' | 'separate';
  sections?: LibrarySeatingSection[];
};

export type LibraryStats = {
  totalMembers: number;
  activeMembers: number;
  rating: number;
  reviewCount: number;
};
export type LibrarySlotPlan = {
  duration: string;  // '1m', '3m', '6m', '12m'
  isActive: boolean;
  discountPercent: number;
};

export type LibrarySlotTrial = {
  duration: string;  // '1d', '3d', '7d' etc
  isActive: boolean;
};

export type LibraryPaymentMethodConfig = {
  type: LibraryPaymentMethod;
  enabled: boolean;
  label: string;
};

@Entity('libraries')
@Index('idx_libraries_owner_id', ['ownerId'])
@Index('idx_libraries_city_active', ['city', 'isActive'])
@Index('idx_libraries_visibility', ['isActive', 'isMarketplaceVisible', 'deletedAt'])
export class LibraryModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  ownerId!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @Column()
  contactPhone!: string;

  @Column()
  contactEmail!: string | null;

  @Column()
  address!: string;

  @Column()
  city!: string;

  @Column()
  state!: string;

  @Column()
  pincode!: string;

  @Column()
  location!: LibraryLocation;

  @Column()
  totalSeats!: number;

  @Column()
  seating?: LibrarySeating;

  @Column()
  facilities!: LibraryFacility[];

  @Column()
  slots!: LibrarySlot[];

  @Column()
  photos!: LibraryPhoto[];

  @Column()
  paymentMethods!: LibraryPaymentMethodConfig[];

  @Column()
  isActive!: boolean;

  @Column()
  isMarketplaceVisible!: boolean;

  @Column()
  isOpen!: boolean;

  @Column()
  openingHours!: string;

  @Column()
  stats!: LibraryStats;

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
