import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { LibraryFacility, LibrarySlotType } from '../constants/library.constants';

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
};

export type LibraryPhoto = {
  url: string;
  publicId: string | null;
  order: number;
  uploadedAt: Date;
};

export type LibraryStats = {
  totalMembers: number;
  activeMembers: number;
  rating: number;
  reviewCount: number;
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
  facilities!: LibraryFacility[];

  @Column()
  slots!: LibrarySlot[];

  @Column()
  photos!: LibraryPhoto[];

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
