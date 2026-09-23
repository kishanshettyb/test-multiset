'use client'

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

import { Button } from '@/components/ui/button'

import {
  Check,
  MapPin,
  Navigation,
  X,
} from 'lucide-react'


// ============================================================
// TYPES
// ============================================================

export type DestinationItem = {
  id: string
  name: string
}


type DestinationDrawerProps = {
  destinations: DestinationItem[]
  selectedId: string | null
  disabled?: boolean
  onSelect: (id: string) => void
}


// ============================================================
// COMPONENT
// ============================================================

export function DestinationDrawer({
  destinations,
  selectedId,
  disabled = false,
  onSelect,
}: DestinationDrawerProps) {

  const selected =
    destinations.find(
      item => item.id === selectedId
    )


  return (
    <Drawer>

      {/* ======================================================
          TRIGGER
      ======================================================= */}

      <DrawerTrigger>

        <Button
          disabled={disabled}
          className="
            h-12
            rounded-2xl
            bg-white
            px-5
            text-black
            shadow-xl
            hover:bg-white/90
            disabled:opacity-50
          "
        >

          <MapPin
            className="
              mr-2
              h-5
              w-5
            "
          />

          {selected
            ? selected.name
            : 'Select destination'}

        </Button>

      </DrawerTrigger>


      {/* ======================================================
          DRAWER
      ======================================================= */}

      <DrawerContent>

        <div
          className="
            mx-auto
            w-full
            max-w-lg
          "
        >

          <DrawerHeader>

            <DrawerTitle>
              Where do you want to go?
            </DrawerTitle>

            <DrawerDescription>
              Select a destination to start
              indoor navigation.
            </DrawerDescription>

          </DrawerHeader>


          {/* ==================================================
              DESTINATIONS
          =================================================== */}

          <div
            className="
              max-h-[55vh]
              overflow-y-auto
              px-4
              pb-4
            "
          >

            <div
              className="
                grid
                gap-2
              "
            >

              {destinations.map(
                destination => {

                  const active =
                    destination.id ===
                    selectedId


                  return (

                    <DrawerClose
                      key={destination.id}
                     
                    >

                      <Button
                        type="button"
                        variant={
                          active
                            ? 'default'
                            : 'outline'
                        }
                        className={`
                          h-14
                          w-full
                          justify-start
                          rounded-xl
                          text-left

                          ${
                            active
                              ? `
                                bg-violet-600
                                hover:bg-violet-600
                              `
                              : ''
                          }
                        `}
                        onClick={() =>
                          onSelect(
                            destination.id
                          )
                        }
                      >

                        {/* ICON */}

                        <Navigation
                          className="
                            mr-3
                            h-5
                            w-5
                          "
                        />


                        {/* NAME */}

                        <span
                          className="
                            text-base
                          "
                        >
                          {destination.name}
                        </span>


                        {/* SELECTED */}

                        {active && (

                          <span
                            className="
                              ml-auto
                              flex
                              items-center
                              gap-1
                              text-xs
                              opacity-90
                            "
                          >

                            <Check
                              className="
                                h-4
                                w-4
                              "
                            />

                            Selected

                          </span>

                        )}

                      </Button>

                    </DrawerClose>

                  )
                }
              )}

            </div>

          </div>


          {/* ==================================================
              FOOTER
          =================================================== */}

          <DrawerFooter>

            <DrawerClose>

              <Button
                variant="outline"
                className="
                  h-12
                  rounded-xl
                "
              >

                <X
                  className="
                    mr-2
                    h-4
                    w-4
                  "
                />

                Close

              </Button>

            </DrawerClose>

          </DrawerFooter>

        </div>

      </DrawerContent>

    </Drawer>
  )
}